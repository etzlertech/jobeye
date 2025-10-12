import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const { itemId } = params;
    const body = await request.json();
    const { imageDataUrl } = body;

    if (!imageDataUrl) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Convert base64 to blob
    const base64Data = imageDataUrl.split(',')[1];
    const bytes = atob(base64Data);
    const arrayBuffer = new ArrayBuffer(bytes.length);
    const uintArray = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < bytes.length; i++) {
      uintArray[i] = bytes.charCodeAt(i);
    }
    
    const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });

    // Upload to Supabase Storage
    const fileName = `items/${itemId}/${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('equipment-images')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('equipment-images')
      .getPublicUrl(fileName);

    // Update item with image URL
    const { data: item, error: updateError } = await supabase
      .from('items')
      .update({ primary_image_url: publicUrl })
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    return NextResponse.json({
      imageUrl: publicUrl,
      message: 'Image uploaded successfully'
    });

  } catch (error) {
    console.error('Error in image upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}