// Routing is application logic; no extra model request is needed.
export function isLayoutRequest(message:string,hasCad=false){
 const text=message.toLowerCase().replace(/[’‘]/g,"'").replace(/\b(but|mais|however)\b/g,",").replace(/\bwithout\s+(?:changing|altering|moving|removing)\b[^.!?;,]*(?:[.!?;,]|$)/g," ").replace(/\b(?:the )?same layout\b/g," ").replace(/\b(?:remove|strip)\b[^.!?;,]{0,35}\b(?:paint|tiles?|wallpaper|flooring|peinture|carrelage)\b/g," ").replace(/(?:don't|won't|do not|ne pas|keep|preserve|retain|garder|conserver|sans changer|no(?: structural| geometry| layout)? changes(?: to)?)[^.!?;,]*(?:[.!?;,]|$)/g," ");
 return /\b(cad|geometry|floor ?plan|layout|structural|demolition|géométrie|agencement|plan 2d|plan 3d|modèle 3d|implantation)\b/.test(text)
 || /\b(move|remove|break|knock down|demolish|rearrange|position|place|fit|add|bring in|déplacer|abattre|casser|démolir|placer|ajouter)\b[^.!?]{0,70}\b(walls?|partitions?|doors?|windows?|sofas?|tables?|furniture|cabinets?|vanity|showers?|bathtubs?|murs?|cloisons?|portes?|fenêtres?|canapés?|meubles?|douches?|baignoires?)\b/.test(text)
 || /\b(where.{0,25}(put|place)|où.{0,25}(mettre|placer))\b/.test(text)
 || (hasCad&&/\b(rotate|rotation|resize|widen|wider|narrower|lengthen|shift|move (it|this|that)|turn.{0,15}degrees|agrandir|redimensionner|pivoter)\b/.test(text));
}
