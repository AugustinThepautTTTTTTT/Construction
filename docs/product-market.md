# Local product market

Every material row in the chat BOM and Materials panel exposes Find nearby products. The button opens a comparison without starting a paid search. The user confirms city, optional postcode and preferences; new searches keep the existing four-credit cost and current paid-plan restrictions. Country and currency come from the owned material bill. No GPS permission or precise location is required.

Searches inspect up to six direct product alternatives within five bounded hosted search calls. Evidence validation rejects invented/unretrieved URLs, unsupported currency, prices and pack sizes. Distinct retailers are shown first, with at most two options per store. Fewer results are valid; proximity, inventory and collection are not asserted without evidence. Searches that fail or return no verified options retain the original bill and refund search credits.

Comparisons are cached only for the same item, preferences, city and postcode. Selection is explicit and uses the existing owner-bound optimistic bill update, preserving quantities and linked work instructions. The carousel provides focused product imagery, pack price, required packs and project total, swipe/arrow/keyboard navigation, reduced-motion support and single-result/empty/error states. Container queries adapt it to narrow project panels as well as small screens.

The preview-only /review/product-market page uses labelled synthetic fixtures; it returns 404 outside Preview. It cannot submit product actions to customer bills. ARCHICOVA_MARKET_EVAL=1 enables a single real-model synthetic market evaluation during a preview build, without changing any customer account or bill. Leave the flag disabled after validation.
