// Bun bundle les imports d'images en URL. Déclaration pour TypeScript.
declare module "*.png" {
  const url: string;
  export default url;
}
