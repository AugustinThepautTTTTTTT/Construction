// Routing is application logic; no extra model request is needed.
function normalizedRequest(message:string){
  return message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'");
}
export function implementationRequest(message:string){
  const text=normalizedRequest(message);
  return {
    materials:/\b(?:bom|bill of materials?|material(?:s)? (?:list|bill|quantities)|list of (?:the )?materials?|shopping list|quantities|quantity assessment|liste (?:des?|de) (?:materiaux|materiels|fournitures)|quantites|nomenclature)\b/.test(text),
    construction:/\b(?:work(?:ing)? (?:steps|instructions|plan)|construction (?:plan|steps)|scope of work|build(?:ing)? (?:steps|instructions)|how (?:do i|to) (?:build|install|paint)|etapes (?:de|des?|pour)|plan (?:de |des )?(?:travaux|construction)|mode operatoire|instructions (?:de|des?|pour)|how to implement|implementation plan)\b/.test(text),
  };
}
export function isVisualRequest(message:string,history:{role:string;content:string}[]=[]):boolean {
  const text=normalizedRequest(message);
  // Negative clauses are removed before considering a positive request elsewhere.
  const positive=text.replace(/\b(?:but|mais)\b/g,',').replace(/\b(?:don't|do not|no|without|sans|pas de|ne pas)\s+(?:(?:generate|generating|create|creating|make|show|want|need|a|an|any|the|un|une|de|generer|creer|faire|nouvelle?|nouveau|new|another|more)\s+)*(?:images?|photos?|visuals?|visuels?|concepts?|rendus?)\b[^.!?;,]*(?:[.!?;,]|$)/g,' ');
  const explicit=/\b(?:generate|create|make|show|render|visualize|visualise|draw|see|want|like|give|veux|souhaite|aimerais|generer|creer|faire|montre\w*|voir|dessine\w*|visualise\w*)\b(?:(?!\b(?:bill|bom|materials?|quantities|instructions|steps|list|shopping|materiaux|materiels|quantites|etapes|travaux|liste)\b)[^.!?;,]){0,75}\b(?:images?|photos?|visuals?|concepts?|renders?|renderings?|before.{0,5}after|visuels?|rendus?)\b/.test(positive)
    || /^(?:please\s+)?(?:(?:a|an|one|un|une)\s+)?(?:new|another|updated|different|nouvelle?|autre|nouveau)\s+(?:images?|photos?|visuals?|concepts?|renders?|visuels?|rendus?)(?:\s+please)?[.!?]*$/.test(positive.trim())
    || /\b(?:and|also|et|aussi)\s+(?:(?:a|an|un|une)\s+)?(?:(?:new|nouveau|nouvelle)\s+)?(?:images?|visuals?|concepts?|renders?|visuels?|rendus?)\b/.test(positive);
  if(explicit)return true;
  const implementation=implementationRequest(positive);
  if(implementation.materials||implementation.construction||isProductSearchRequest(positive))return false;
  if (/\b(?:montre\w*|voir|visualise\w*|show|visualize|visualise)\b[^.!?;,]{0,70}\b(?:renovation|renovated|renove\w*|refurbishment)\b/.test(positive) && !/\b(?:sans|pas|no|without|do not|don't)\b/.test(text)) return true;
  if(/\b(?:condition|damage|cracks?|mould|mold|damp|diagnos\w*|etat|humidite|moisissure)\b/.test(positive))return false;
  if(/\b(?:no|without|sans|pas de|don't|do not|ne pas)\b[^.!?;,]{0,45}\b(?:images?|visuals?|visuels?|photos?|concepts?|rendus?)\b/.test(text))return false;
  // A new design request can create a concept; existing photographs or old
  // concepts alone never carry image permission into a subsequent turn.
  if(/\b(?:moderni[sz]\w*|refurbish\w*|redesign\w*|redecorat\w*|renovate\w*|refresh|improv\w*|transform\w*|relook\w*|renov\w*|rafraich\w*|amelior\w*)\b[^.!?]{0,80}\b(?:room|space|living|kitchen|bathroom|bedroom|piece|salon|cuisine|chambre|salle)\b/.test(positive))return true;
  if(/\b(?:make|change|repaint|paint|replace|add|swap|rendre|changer|repeindre|remplacer|ajouter)\b[^.!?]{0,80}\b(?:warmer|brighter|modern|colour|color|walls?|floor|curtains?|sofa|green|blue|white|beige|terracotta|bois|murs?|couleur|plancher|canape|vert|bleu|blanc|clair|moderne)\b/.test(positive))return true;
  if(!/^(?:yes|yes please|ok|okay|go ahead|do it|please do|oui|oui merci|vas-y|allez)[.!\s]*$/.test(positive.trim()))return false;
  const offer=history.filter(m=>m.role==='assistant'&&m.content.trim()).at(-1)?.content||'';
  // Only a direct offer ending in a question grants short-answer consent.
  return /[?]/.test(offer)&&/\b(?:image|visual|concept|render|visuel|rendu)\b/.test(normalizedRequest(offer))&&/\b(?:generate|create|show|want|would you like|generer|creer|souhaitez|voulez)\b/.test(normalizedRequest(offer));
}

export function visualRequestedForArtifact(messages:{role:string;content:string;artifactIds?:string[]}[],id:string){
  const at=messages.findIndex(m=>m.role==='assistant'&&m.artifactIds?.includes(id));
  if(at<0)return true; // Legacy assets without a chat association remain accessible.
  for(let i=at-1;i>=0;i--)if(messages[i].role==='user')return isVisualRequest(messages[i].content,messages.slice(0,i));
  return true;
}

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
