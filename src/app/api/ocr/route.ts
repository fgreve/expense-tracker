import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadImage } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { extractText } from "unpdf";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT_BASE = `Eres un asistente que analiza recibos, tickets y facturas. Extrae la informacion y responde SOLO con un JSON valido (sin markdown, sin backticks) con esta estructura:
{
  "ocrText": "texto completo extraido del recibo",
  "amount": numero total (el monto mas alto o el total final),
  "description": "descripcion corta del gasto (nombre del negocio o concepto principal)",
  "category": "una de estas categorias: CATEGORIES",
  "date": "fecha del recibo en formato YYYY-MM-DD si es visible, o null"
}
Si no puedes extraer algun campo, usa null para ese campo. Para category, elige la mas apropiada basandote en el tipo de negocio o productos del recibo.`;

function parseOcrResponse(content: string, categoryNames: string[], imageUrl: string | null) {
  try {
    const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    return {
      ocrText: parsed.ocrText || content,
      amount: parsed.amount || null,
      description: parsed.description || null,
      category: categoryNames.includes(parsed.category) ? parsed.category : categoryNames[0] || "Otros",
      date: parsed.date || null,
      imageUrl,
    };
  } catch {
    return {
      ocrText: content,
      amount: null,
      description: null,
      category: categoryNames[0] || "Otros",
      date: null,
      imageUrl,
    };
  }
}

async function processImage(buffer: Buffer, mimeType: string, categoryNames: string[], imageUrl: string | null) {
  const base64 = buffer.toString("base64");
  const systemPrompt = SYSTEM_PROMPT_BASE.replace("CATEGORIES", categoryNames.join(", "));

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: "Analiza este recibo y extrae la informacion:" },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } },
        ],
      },
    ],
    max_tokens: 1000,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content?.trim() || "";
  return parseOcrResponse(content, categoryNames, imageUrl);
}

async function processPdf(buffer: Buffer, categoryNames: string[], imageUrl: string | null) {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  const systemPrompt = SYSTEM_PROMPT_BASE.replace("CATEGORIES", categoryNames.join(", "));

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Analiza este texto extraido de un recibo/factura PDF y extrae la informacion:\n\n${text}`,
      },
    ],
    max_tokens: 1000,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content?.trim() || "";
  return parseOcrResponse(content, categoryNames, imageUrl);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se envio archivo" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = file.type || "image/jpeg";
    const isPdf = mimeType === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");

    // Upload to Cloudinary (images and PDFs)
    let imageUrl: string | null = null;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        imageUrl = await uploadImage(buffer, mimeType);
      } catch (err) {
        console.error("Cloudinary upload error:", err);
      }
    }

    // Get categories from database
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    const categoryNames = categories.map((c) => c.name);

    const result = isPdf
      ? await processPdf(buffer, categoryNames, imageUrl)
      : await processImage(buffer, mimeType, categoryNames, imageUrl);

    return NextResponse.json(result);
  } catch (error) {
    console.error("OCR error:", error);
    return NextResponse.json({ error: "Error al procesar el archivo con OpenAI" }, { status: 500 });
  }
}
