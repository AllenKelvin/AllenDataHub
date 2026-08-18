const viteEnv = typeof import.meta !== "undefined" ? import.meta.env ?? {} : {};
const processEnv = typeof globalThis !== "undefined" && "process" in globalThis ? (globalThis as any).process?.env ?? {} : {};
const envUri = viteEnv.VITE_MONGO_URI || viteEnv.VITE_DATABASE_URL || processEnv.MONGO_URI || processEnv.DATABASE_URL || "";
const envDbName = viteEnv.VITE_MONGO_DB_NAME || processEnv.MONGO_DB_NAME || "platform";

export const MONGO_URI = envUri || "mongodb+srv://jenniferfredson175_db_user:Clarck3223@platform.0hnpxgu.mongodb.net/?appName=platform";
export const MONGO_DB_NAME = envDbName;
export const APP_NAME = "AllenDataHub";
