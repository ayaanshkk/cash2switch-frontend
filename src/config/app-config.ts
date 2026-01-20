import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "FAI",
  version: packageJson.version,
  copyright: `© ${currentYear}, Forklift Academy of India.`,
  meta: {
    title: "Forklift Academy of India",
    description: "Forklift Academy of India",
  },
  // ✅ Add your base path here
  basePath: "/streemlyne",
};
