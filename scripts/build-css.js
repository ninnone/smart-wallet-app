const fs = require('fs');
const path = require('path');

// Importer les plugins PostCSS
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const postcss = require('postcss');

// Chemins
const inputFile = path.join(__dirname, '..', 'configs', 'input.css');
const outputFile = path.join(__dirname, '..', 'public', 'assets', 'css', 'main.css');

// S'assurer que le dossier de sortie existe
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Lire le fichier CSS d'entrée
const css = fs.readFileSync(inputFile, 'utf8');

// Compiler avec PostCSS (Tailwind + Autoprefixer + Minification)
postcss([tailwindcss, autoprefixer, cssnano({ preset: 'default' })])
  .process(css, {
    from: inputFile,
    to: outputFile,
    map: false,
  })
  .then((result) => {
    // Écrire le fichier de sortie (déjà minifié par cssnano)
    fs.writeFileSync(outputFile, result.css, 'utf8');
    console.log('✅ CSS compiled and minified successfully!');
  })
  .catch((error) => {
    console.error('❌ Error compiling CSS:', error);
    process.exit(1);
  });
