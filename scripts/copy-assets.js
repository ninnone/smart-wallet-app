const fs = require('fs');
const path = require('path');

// Fonction pour copier récursivement les fichiers
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    // Créer le répertoire de destination s'il n'existe pas
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

// Chemins source et destination
const assetsSrc = path.join(__dirname, '..', 'assets');
const assetsDest = path.join(__dirname, '..', 'public', 'assets');

// S'assurer que le dossier public/assets/css existe
if (!fs.existsSync(assetsDest)) {
  fs.mkdirSync(assetsDest, { recursive: true });
}

// Copier les fichiers CSS (sauf main.css qui est généré par Tailwind)
const cssSrc = path.join(assetsSrc, 'css');
const cssDest = path.join(assetsDest, 'css');

if (fs.existsSync(cssSrc)) {
  if (!fs.existsSync(cssDest)) {
    fs.mkdirSync(cssDest, { recursive: true });
  }
  const cssFiles = fs.readdirSync(cssSrc);
  cssFiles.forEach(file => {
    if (file !== 'main.css') { // Ne pas écraser main.css généré par Tailwind
      const srcFile = path.join(cssSrc, file);
      const destFile = path.join(cssDest, file);
      fs.copyFileSync(srcFile, destFile);
      console.log(`Copied: ${file}`);
    }
  });
}

// Copier les fichiers JavaScript
const jsSrc = path.join(assetsSrc, 'js');
const jsDest = path.join(assetsDest, 'js');

if (fs.existsSync(jsSrc)) {
  copyRecursiveSync(jsSrc, jsDest);
  console.log('Copied all JS files');
}

// Copier les images
const imagesSrc = path.join(assetsSrc, 'images');
const imagesDest = path.join(assetsDest, 'images');

if (fs.existsSync(imagesSrc)) {
  copyRecursiveSync(imagesSrc, imagesDest);
  console.log('Copied all image files');
}

// Copier les pages HTML dans public
const pagesSrc = path.join(__dirname, '..', 'src', 'pages');
const pagesDest = path.join(__dirname, '..', 'public', 'src', 'pages');

if (fs.existsSync(pagesSrc)) {
  copyRecursiveSync(pagesSrc, pagesDest);
  console.log('Copied all HTML pages');
}

// Copier index.html dans public (toujours copier pour être sûr qu'il est à jour)
const indexSrc = path.join(__dirname, '..', 'index.html');
const indexDest = path.join(__dirname, '..', 'public', 'index.html');

if (fs.existsSync(indexSrc)) {
  // Créer le dossier public s'il n'existe pas
  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.copyFileSync(indexSrc, indexDest);
  console.log('Copied index.html');
}

console.log('✅ All assets copied successfully!');
