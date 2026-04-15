import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const userId = formData.get('userId') as string;

  if (!file || !userId) {
    return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 });
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}.${fileExt}`;
  const arrayBuffer = await file.arrayBuffer();

  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/avatars/${fileName}`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: arrayBuffer,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    return NextResponse.json({ error: errorText }, { status: uploadResponse.status });
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${fileName}?t=${Date.now()}`;
  return NextResponse.json({ url: publicUrl });
}
