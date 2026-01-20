// First install: npm install handlebars @types/handlebars
import Handlebars from "handlebars";

// Register Handlebars helpers
Handlebars.registerHelper("formatCurrency", function (value: number) {
  return `£${value.toFixed(2)}`;
});

Handlebars.registerHelper("formatDate", function (dateString: string) {
  return new Date(dateString).toLocaleDateString("en-GB");
});

Handlebars.registerHelper("breaklines", function (text: string) {
  if (!text) return "";
  return new Handlebars.SafeString(text.replace(/\n/g, "<br>"));
});

export function compileTemplate(templateContent: string, data: any): string {
  const template = Handlebars.compile(templateContent);
  return template(data);
}

// If using this approach, update your API route to use:
// const htmlContent = compileTemplate(htmlTemplate, {
//   ...quoteData,
//   quoteNumber,
//   validUntil,
//   formattedDate: new Date(quoteData.date).toLocaleDateString('en-GB')
// });
