# bundlecheck

> **[EN]** Analyze JavaScript and CSS bundle sizes — raw, gzip, and Brotli — and enforce size budgets in CI pipelines.
> **[FR]** Analysez la taille de vos bundles JavaScript et CSS — brut, gzip et Brotli — et appliquez des budgets de taille dans vos pipelines CI.

---

## Features / Fonctionnalités

**[EN]**
- Reports raw size, gzip, and Brotli compressed sizes for every asset
- Recursively walks build output directories (`dist`, `build`, etc.)
- Supports `.js`, `.css`, and `.mjs` files by default
- Configurable size budget in kilobytes via `--budget`
- Exits with code 1 when any file exceeds the budget — perfect for CI
- `--json` flag for structured output in automation pipelines
- Sorts results by raw file size (largest first)

**[FR]**
- Affiche la taille brute, gzip et Brotli pour chaque asset
- Parcourt récursivement les répertoires de build (`dist`, `build`, etc.)
- Prend en charge `.js`, `.css` et `.mjs` par défaut
- Budget de taille configurable en kilo-octets via `--budget`
- Quitte avec le code 1 si un fichier dépasse le budget — idéal pour CI
- Flag `--json` pour une sortie structurée dans les pipelines d'automatisation
- Résultats triés par taille brute (les plus grands en premier)

---

## Installation

```bash
npm install -g @idirdev/bundlecheck
```

---

## CLI Usage / Utilisation CLI

```bash
# Analyze default ./dist folder
# Analyser le dossier ./dist par défaut
bundlecheck

# Analyze a custom build output folder
# Analyser un dossier de build personnalisé
bundlecheck ./build

# Set a 200 KB budget per file
# Définir un budget de 200 Ko par fichier
bundlecheck ./dist --budget 200

# Output JSON for CI tooling or dashboards
# Retourner JSON pour les outils CI ou tableaux de bord
bundlecheck ./dist --json

# CI usage: fail the build if bundle is too large
# Usage CI : faire échouer le build si le bundle est trop grand
bundlecheck ./dist --budget 150 || exit 1
```

### Example Output / Exemple de sortie

```
File                                         Raw      Gzip    Brotli
main.chunk.js                             245.3KB    78.1KB    62.4KB
vendor.chunk.js                           198.7KB    61.2KB    49.8KB
styles.css                                 34.2KB    11.8KB     9.3KB
runtime.js                                  3.1KB     1.4KB     1.1KB

Total: 481.3KB (gzip: 152.5KB)
Budget exceeded!
```

---

## API (Programmatic) / API (Programmation)

```js
const { analyzeFile, analyzeDir, checkBudget, formatSize } = require('@idirdev/bundlecheck');

// Analyze a single file
// Analyser un seul fichier
const result = analyzeFile('./dist/main.js');
// => { file: 'main.js', raw: 251187, gzipped: 79921, brotli: 63840,
//      rawStr: '245.3KB', gzipStr: '78.1KB', brotliStr: '62.4KB' }

// Analyze an entire directory
// Analyser un répertoire entier
const files = analyzeDir('./dist');
// => Array of file result objects, sorted by raw size (largest first)

// Custom extensions
// Extensions personnalisées
const files2 = analyzeDir('./dist', { extensions: ['.js', '.css', '.mjs'] });

// Check against a size budget
// Vérifier par rapport à un budget de taille
const budget = checkBudget(files, { maxRaw: 300 * 1024, maxGzip: 100 * 1024 });
// => { ok: false, violations: [...], totalRaw: 481300, totalGzip: 156340 }

// Format bytes to human-readable string
// Formater les octets en chaîne lisible
formatSize(1048576); // => '1.00MB'
formatSize(2048);    // => '2.0KB'
```

---

## License

MIT © idirdev
