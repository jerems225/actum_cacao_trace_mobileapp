// ============================================================================
// Actum Collect — Contrôle des noms d'icônes
// ----------------------------------------------------------------------------
// Vérifie que chaque nom d'icône écrit dans le code existe bien dans le
// glyphmap Ionicons INSTALLÉ. Un nom absent ne provoque ni erreur de
// compilation, ni avertissement au démarrage : l'icône se dessine simplement
// vide, et le défaut ne se voit qu'à l'écran, souvent sur un écran rarement
// ouvert.
//
// Le typage TypeScript couvre déjà les cas écrits en clair
// (`keyof typeof Ionicons.glyphMap`), mais pas les noms construits ni ceux
// passés en `string`. Et il ne dit rien après un changement de version du
// paquet, où un nom peut disparaître.
//
// À lancer avant un build : `npm run verifier:icones`.
// ============================================================================

const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const CHEMIN_GLYPHES = path.join(
  RACINE,
  'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json',
);

if (!fs.existsSync(CHEMIN_GLYPHES)) {
  console.error("Glyphmap introuvable. Lancez `npm install` d'abord.");
  process.exit(1);
}

const glyphes = JSON.parse(fs.readFileSync(CHEMIN_GLYPHES, 'utf8'));

function sourcesTsx(dossier) {
  const sortie = [];
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name === 'node_modules' || entree.name.startsWith('.')) continue;
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) sortie.push(...sourcesTsx(complet));
    else if (/\.tsx?$/.test(entree.name)) sortie.push(complet);
  }
  return sortie;
}

/**
 * Mots qui ressemblent à un nom d'icône sans en être un : valeurs de test dans
 * un ternaire (`mode === 'fermer' ? 'close-outline' : …`), clés de réglage.
 * Les lister ici évite de faire échouer le contrôle sur un faux positif — le
 * jour où il crie au loup pour rien, plus personne ne le lance.
 */
const NON_ICONES = new Set(['fermer', 'nouveau']);

const motifs = [
  /\bname=["']([a-z0-9-]+)["']/g,
  /\b(?:icon|icone|iconName)(?:\s*:\s*|=)["']([a-z0-9-]+)["']/g,
  /\bname:\s*["']([a-z0-9-]+)["']\s+as\s+const/g,
];

const releves = new Map();

const fichiers = [...sourcesTsx(path.join(RACINE, 'src')), path.join(RACINE, 'App.tsx')];
for (const fichier of fichiers) {
  if (!fs.existsSync(fichier)) continue;
  const texte = fs.readFileSync(fichier, 'utf8');
  // Un fichier qui n'importe pas Ionicons n'a pas d'icône : l'ignorer évite de
  // confondre un `name="email"` de formulaire avec un nom d'icône.
  if (!texte.includes('Ionicons')) continue;

  const rel = path.relative(RACINE, fichier);
  const noter = (nom) => {
    if (NON_ICONES.has(nom)) return;
    if (!releves.has(nom)) releves.set(nom, new Set());
    releves.get(nom).add(rel);
  };

  for (const motif of motifs) {
    for (const m of texte.matchAll(motif)) noter(m[1]);
  }
  // Ternaires : plusieurs littéraux dans un même `name={…}`.
  for (const m of texte.matchAll(/\bname=\{([^}]*)\}/g)) {
    for (const litteral of m[1].matchAll(/["']([a-z0-9-]+)["']/g)) noter(litteral[1]);
  }
}

const inconnus = [...releves.entries()].filter(([nom]) => !(nom in glyphes));

console.log(`Glyphmap : ${Object.keys(glyphes).length} icônes — ${releves.size} noms relevés.`);

if (inconnus.length === 0) {
  console.log('✔ Tous les noms d’icônes existent dans le glyphmap installé.');
  process.exit(0);
}

console.error(`\n✖ ${inconnus.length} nom(s) introuvable(s) — ces icônes s’afficheront vides :\n`);
for (const [nom, fichiers] of inconnus) {
  console.error(`  « ${nom} »`);
  for (const f of fichiers) console.error(`      ${f}`);
}
console.error(
  "\nSi le nom est correct, il a peut-être disparu du paquet : vérifier sur " +
    'https://icons.expo.fyi (famille Ionicons).',
);
process.exit(1);
