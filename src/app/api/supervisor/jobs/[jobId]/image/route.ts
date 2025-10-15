import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ItemImageProcessor } from '@/utils/image-processor';
import { getRequestContext } from '@/lib/auth/context';

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    // Get request context (handles both session and header-based auth)
    const context = await getRequestContext(request);
    const { tenantId } = context;

    console.log('Image upload API called for job:', jobId, 'tenant:', tenantId, 'Source:', context.source);

    const body = await request.json();
    const { images } = body;

    if (!images || !images.thumbnail || !images.medium || !images.full) {
      console.error('Missing image data:', {
        hasImages: !!images,
        hasThumbnail: !!images?.thumbnail,
        hasMedium: !!images?.medium,
        hasFull: !!images?.full
      });
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    console.log('Received images:', {
      thumbnailLength: images.thumbnail.length,
      mediumLength: images.medium.length,
      fullLength: images.full.length
    });

    const supabase = createServiceClient();
    const timestamp = Date.now();
    const imageUrls = {
      thumbnail_url: '',
      medium_url: '',
      primary_image_url: ''
    };

    // Upload all three sizes
    const sizes = [
      { name: 'thumbnail', data: images.thumbnail, field: 'thumbnail_url' },
      { name: 'medium', data: images.medium, field: 'medium_url' },
      { name: 'full', data: images.full, field: 'primary_image_url' }
    ];

    for (const size of sizes) {
      // Convert data URL to blob
      const blob = ItemImageProcessor.dataUrlToBlob(size.data);

      // Upload to Supabase Storage
      const fileName = `jobs/${jobId}/${timestamp}-${size.name}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('equipment-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      console.log(`Uploading ${size.name} image to: ${fileName}`);

      if (uploadError) {
        console.error(`Upload error for ${size.name}:`, uploadError);
        return NextResponse.json({
          error: `Failed to upload ${size.name} image: ${uploadError.message}`
        }, { status: 500 });
      }

      console.log(`Successfully uploaded ${size.name} image`);

      // Get public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('equipment-images')
        .getPublicUrl(fileName);

      imageUrls[size.field as keyof typeof imageUrls] = publicUrl;
    }

    // Update job with all image URLs
    console.log('Updating database with:', {
      primary_image_url: imageUrls.primary_image_url,
      thumbnail_url: imageUrls.thumbnail_url,
      medium_url: imageUrls.medium_url,
      jobId,
      tenantId
    });

    const { data: job, error: updateError } = await supabase
      .from('jobs')
      .update({
        primary_image_url: imageUrls.primary_image_url,
        thumbnail_url: imageUrls.thumbnail_url,
        medium_url: imageUrls.medium_url
      })
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    console.log('Updating job with URLs:', imageUrls);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: `Failed to update job: ${updateError.message}` }, { status: 500 });
    }

    console.log('Job updated successfully:', job?.id);

    return NextResponse.json({
      imageUrls,
      message: 'Images uploaded successfully'
    });

  } catch (error) {
    console.error('Error in image upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
