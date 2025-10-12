import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ItemImageProcessor } from '@/utils/image-processor';

export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params;
    const body = await request.json();
    const { images } = body;

    if (!images || !images.thumbnail || !images.medium || !images.full) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

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
      const fileName = `items/${itemId}/${timestamp}-${size.name}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('equipment-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error(`Upload error for ${size.name}:`, uploadError);
        return NextResponse.json({ 
          error: `Failed to upload ${size.name} image` 
        }, { status: 500 });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from('equipment-images')
        .getPublicUrl(fileName);

      imageUrls[size.field as keyof typeof imageUrls] = publicUrl;
    }

    // Update item with all image URLs
    const { data: item, error: updateError } = await supabase
      .from('items')
      .update({ 
        primary_image_url: imageUrls.primary_image_url,
        thumbnail_url: imageUrls.thumbnail_url,
        medium_url: imageUrls.medium_url
      })
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

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