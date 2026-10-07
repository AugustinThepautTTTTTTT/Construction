export const SITE = {
  name: "Archicova", url: "https://archicova.com",
  title: "Archicova — AI Interior Design & Renovation Planner",
  description: "Reimagine your room with AI. Turn photos into interior design concepts, material lists, renovation cost estimates and a step-by-step work plan. Start free.",
};
export function searchRobots(environment = process.env.VERCEL_ENV) {
  const index = environment !== "preview" && environment !== "development";
  return { index, follow: index };
}
export function structuredData() {
  return [
    { "@context": "https://schema.org", "@type": "Organization", "@id": `${SITE.url}/#organization`, name: SITE.name, url: SITE.url, logo: `${SITE.url}/brand/logo-512.png` },
    { "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE.url}/#website`, name: SITE.name, url: SITE.url, inLanguage: "en", publisher: { "@id": `${SITE.url}/#organization` } },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: SITE.name, url: SITE.url, description: SITE.description, applicationCategory: "DesignApplication", operatingSystem: "Web", offers: [
      { "@type": "Offer", name: "Free", price: 0, priceCurrency: "USD", description: "10 credits once per account" },
      { "@type": "Offer", name: "Basic", price: 5, priceCurrency: "USD", description: "Monthly subscription with 30 credits" },
      { "@type": "Offer", name: "Pro", price: 50, priceCurrency: "USD", description: "Monthly subscription with 350 credits" },
    ] },
  ] as const;
}
