// Routing is application logic; no extra model request is needed.
export function isLayoutRequest(message: string, hasCad = false) {
  const text = message
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\b(but|mais|however)\b/g, ",")
    .replace(
      /\bwithout\s+(?:changing|altering|moving|removing)\b[^.!?;,]*(?:[.!?;,]|$)/g,
      " ",
    )
    .replace(/\b(?:the )?same layout\b/g, " ")
    .replace(
      /\b(?:remove|strip)\b[^.!?;,]{0,35}\b(?:paint|tiles?|wallpaper|flooring|peinture|carrelage)\b/g,
      " ",
    )
    .replace(
      /(?:don't|won't|do not|ne pas|keep|preserve|retain|garder|conserver|sans changer|no(?: structural| geometry| layout)? changes(?: to)?)[^.!?;,]*(?:[.!?;,]|$)/g,
      " ",
    );
  return (
    /\b(cad|geometry|floor ?plan|layout|structural|demolition|géométrie|agencement|plan 2d|plan 3d|modèle 3d|implantation)\b/.test(
      text,
    ) ||
    /\b(move|remove|break|knock down|demolish|rearrange|position|place|fit|add|bring in|déplacer|abattre|casser|démolir|placer|ajouter)\b[^.!?]{0,70}\b(walls?|partitions?|doors?|windows?|sofas?|tables?|furniture|cabinets?|vanity|showers?|bathtubs?|murs?|cloisons?|portes?|fenêtres?|canapés?|meubles?|douches?|baignoires?)\b/.test(
      text,
    ) ||
    /\b(where.{0,25}(put|place)|où.{0,25}(mettre|placer))\b/.test(text) ||
    (hasCad &&
      /\b(rotate|rotation|resize|widen|wider|narrower|lengthen|shift|move (it|this|that)|turn.{0,15}degrees|agrandir|redimensionner|pivoter)\b/.test(
        text,
      ))
  );
}

export function isProductSearchRequest(
  text: string,
  history: { role: string; content: string }[] = [],
): boolean {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'");
  const clean = normalized.replace(
    /(?:sans|without|no|do not|don't|ne pas|pas de)\s+(?:faire\s+de\s+|web\s+)?(?:recherche(?:\s+internet)?|search(?:\s+the\s+web)?|internet|product research)\b/g,
    " ",
  );
  if (
    /\b(?:find|search|compare|shop for|look for|look up|where.{0,20}buy|trouv\w*|cherch\w*|recherch\w*|compar\w*|ou.{0,20}achet\w*|fournisseur|supplier|retailer|product links?|shopping alternatives|different.{0,25}(?:products|paints|flooring)|online.{0,15}(?:shop|product)|internet)\b/.test(
      clean,
    )
  )
    return true;
  if (
    /\b(?:references?|liens?|links?|produits? concrets?|produits? precis|specific products?|actual products?)\b/.test(
      clean,
    ) &&
    !/\b(?:photos?|images?|visuels?|cad|plans?)\b/.test(clean)
  )
    return true;
  // A short answer to an explicit product-search offer is consent for that item,
  // not a persistent permission to research later BOMs or image requests.
  const previous =
    history.filter((m) => m.role === "assistant" && m.content.trim()).at(-1)
      ?.content || "";
  if (
    clean.length > 160 ||
    /\b(?:non|no|stop|cancel|annul|sans|without|image|photo|visuel|bom|plan|create|creer|change|remplac)\b/.test(
      clean,
    )
  )
    return false;
  const offer = previous
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const asking =
    /[?]|\b(?:voulez|souhaitez|would you|which|quel|lequel|want me)\b/.test(
      offer,
    );
  return (
    asking &&
    isProductSearchRequest(previous) &&
    /\b(?:produit|product|materiau|material|item|article|magasin|shop|peinture|paint|carrelage|tile)\w*\b/.test(
      offer,
    ) &&
    !/(?:not available|unavailable|pas.{0,20}disponible)/.test(offer) &&
    clean.trim().length > 0
  );
}
