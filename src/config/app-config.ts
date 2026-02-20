import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Business Rates Solutions",
  version: packageJson.version,
  copyright: `© ${currentYear}, Business Rates Solutions.`,
  meta: {
    title: "Business Rates Solutions",
    description: "Business Rates Solutions",
  },
  // ✅ Add your base path here
  basePath: "/streemlyne",
};
