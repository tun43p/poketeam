// Bun bundles image imports as URLs. Declaration for TypeScript.
declare module "*.png" {
  const url: string;
  export default url;
}
