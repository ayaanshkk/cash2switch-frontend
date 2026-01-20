import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
// Import Buffer from Node.js standard library (available in Next.js API Routes)
import { Buffer } from "buffer";

interface QuoteItem {
  item: string;
  description: string;
  colour: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface QuoteData {
  date: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
  items: QuoteItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  quoteNumber?: string;
}

export async function POST(request: NextRequest) {
  try {
    const quoteData: QuoteData = await request.json(); // Read the HTML template

    const templatePath = path.join(process.cwd(), "src", "templates", "quote-template.html");
    let htmlTemplate = fs.readFileSync(templatePath, "utf-8"); // Generate quote number if not provided

    const quoteNumber = quoteData.quoteNumber || `Q${Date.now()}`; // Calculate valid until date (30 days from now)
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + 30);
    const validUntil = validUntilDate.toLocaleDateString("en-GB"); // Simple template replacement (you might want to use a proper template engine like Handlebars)

    htmlTemplate = htmlTemplate
      .replace(/{{quoteNumber}}/g, quoteNumber)
      .replace(/{{date}}/g, new Date(quoteData.date).toLocaleDateString("en-GB"))
      .replace(/{{validUntil}}/g, validUntil)
      .replace(/{{name}}/g, quoteData.name || "")
      .replace(/{{address}}/g, quoteData.address ? quoteData.address.replace(/\n/g, "<br>") : "")
      .replace(/{{phone}}/g, quoteData.phone || "")
      .replace(/{{email}}/g, quoteData.email || "")
      .replace(/{{notes}}/g, quoteData.notes || "")
      .replace(/{{subtotal}}/g, quoteData.subtotal.toFixed(2))
      .replace(/{{vatAmount}}/g, quoteData.vatAmount.toFixed(2))
      .replace(/{{total}}/g, quoteData.total.toFixed(2)); // Handle items table

    let itemsHtml = "";
    quoteData.items.forEach((item) => {
      itemsHtml += `
        <tr>
          <td>${item.item || ""}</td>
          <td>${item.description || ""}</td>
          <td>${item.colour || ""}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">£${item.unitPrice.toFixed(2)}</td>
          <td class="text-right">£${item.amount.toFixed(2)}</td>
        </tr>
      `;
    }); // Replace items placeholder

    htmlTemplate = htmlTemplate.replace(/{{#each items}}[\s\S]*?{{\/each}}/g, itemsHtml); // Handle conditional sections

    if (!quoteData.address) {
      htmlTemplate = htmlTemplate.replace(/{{#if address}}[\s\S]*?{{\/if}}/g, "");
    } else {
      htmlTemplate = htmlTemplate.replace(/{{#if address}}([\s\S]*?){{\/if}}/g, "$1");
    }

    if (!quoteData.phone) {
      htmlTemplate = htmlTemplate.replace(/{{#if phone}}[\s\S]*?{{\/if}}/g, "");
    } else {
      htmlTemplate = htmlTemplate.replace(/{{#if phone}}([\s\S]*?){{\/if}}/g, "$1");
    }

    if (!quoteData.email) {
      htmlTemplate = htmlTemplate.replace(/{{#if email}}[\s\S]*?{{\/if}}/g, "");
    } else {
      htmlTemplate = htmlTemplate.replace(/{{#if email}}([\s\S]*?){{\/if}}/g, "$1");
    }

    if (!quoteData.notes) {
      htmlTemplate = htmlTemplate.replace(/{{#if notes}}[\s\S]*?{{\/if}}/g, "");
    } else {
      htmlTemplate = htmlTemplate.replace(/{{#if notes}}([\s\S]*?){{\/if}}/g, "$1");
    } // Launch puppeteer and generate PDF

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlTemplate, { waitUntil: "networkidle0" }); // pdfBuffer is Uint8Array (or ArrayBufferLike)
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: "20mm",
        left: "20mm",
      },
    });

    await browser.close();

    // ----------------------------------------------------
    // FIX APPLIED HERE: Convert ArrayBufferLike to Node.js Buffer
    // ----------------------------------------------------
    const pdfNodeBuffer = Buffer.from(pdfBuffer); // Return the PDF as a response

    return new NextResponse(pdfNodeBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quote-${quoteNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
