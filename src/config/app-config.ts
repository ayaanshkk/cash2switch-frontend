import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Business Gas",
  version: packageJson.version,
  copyright: `© ${currentYear}, Business Gas.`,
  meta: {
    title: "Business Gas",
    description: "Business Gas",
  },
  // ✅ Add your base path here
  basePath: "/streemlyne",
};
