#!/bin/bash
# Fix v5 — Dummy.swift au bon endroit (ios/ au lieu de ios/PatriMoiApp/)
APP_DIR="$HOME/PatriMoiApp"

echo "================================================"
echo "  PatriMoi — Fix Swift v5 (Dummy.swift path)"
echo "================================================"

# Xcode cherche le fichier à ios/Dummy.swift
cat > "$APP_DIR/ios/Dummy.swift" << 'EOF'
// Dummy.swift — forces Swift runtime linking
import Foundation
EOF
echo "✓ Créé: $APP_DIR/ios/Dummy.swift"

# Nettoyer DerivedData
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/PatriMoiApp-"* 2>/dev/null || true
echo "✓ DerivedData nettoyé"

echo ""
echo "================================================"
echo "  Dans Xcode : ⇧⌘K puis ▶"
echo "================================================"
read -p "Entrée pour fermer..."
