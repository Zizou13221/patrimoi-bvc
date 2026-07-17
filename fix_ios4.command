#!/bin/bash
# PatriMoi — Fix Swift v4 — Dummy.swift dans le projet Xcode
APP_DIR="$HOME/PatriMoiApp"
PBXPROJ="$APP_DIR/ios/PatriMoiApp.xcodeproj/project.pbxproj"
DUMMY="$APP_DIR/ios/PatriMoiApp/Dummy.swift"

echo "================================================"
echo "  PatriMoi — Fix Swift v4 (Dummy.swift)"
echo "================================================"
echo ""

# 1. Créer le fichier Dummy.swift
cat > "$DUMMY" << 'EOF'
// Dummy.swift — forces Swift runtime linking (fixes swiftCompatibility linker errors)
import Foundation
EOF
echo "✓ Dummy.swift créé"

# 2. Modifier le pbxproj avec Python
python3 << 'PYEOF'
import re, uuid, sys

pbx_path = '/Users/z.othmane/PatriMoiApp/ios/PatriMoiApp.xcodeproj/project.pbxproj'

try:
    content = open(pbx_path).read()
except:
    print("ERREUR: pbxproj introuvable à " + pbx_path)
    sys.exit(1)

# Vérifier si Dummy.swift déjà présent
if 'Dummy.swift' in content:
    print("✓ Dummy.swift déjà dans le pbxproj")
    sys.exit(0)

# Générer des UUIDs style Xcode (24 hex uppercase)
def xc_uuid():
    return uuid.uuid4().hex[:24].upper()

file_ref_uuid  = xc_uuid()
build_file_uuid = xc_uuid()

print(f"FileRef UUID  : {file_ref_uuid}")
print(f"BuildFile UUID: {build_file_uuid}")

# --- 1. Ajouter PBXFileReference ---
file_ref_entry = f'\t\t{file_ref_uuid} /* Dummy.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Dummy.swift; sourceTree = "<group>"; }};\n'

content = re.sub(
    r'(/\* Begin PBXFileReference section \*/\n)',
    r'\1' + file_ref_entry,
    content
)

# --- 2. Ajouter PBXBuildFile ---
build_file_entry = f'\t\t{build_file_uuid} /* Dummy.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {file_ref_uuid} /* Dummy.swift */; }};\n'

content = re.sub(
    r'(/\* Begin PBXBuildFile section \*/\n)',
    r'\1' + build_file_entry,
    content
)

# --- 3. Ajouter au groupe PatriMoiApp (children) ---
# Trouver AppDelegate.mm dans un groupe et ajouter Dummy.swift juste après
content = re.sub(
    r'([\dA-F]{24} /\* AppDelegate\.mm \*/,)',
    r'\1\n\t\t\t\t' + file_ref_uuid + ' /* Dummy.swift */,',
    content
)

# --- 4. Ajouter aux Sources Build Phase du target principal ---
# Trouver "AppDelegate.mm in Sources" et ajouter Dummy.swift juste après
content = re.sub(
    r'([\dA-F]{24} /\* AppDelegate\.mm in Sources \*/,)',
    r'\1\n\t\t\t\t' + build_file_uuid + ' /* Dummy.swift in Sources */,',
    content
)

open(pbx_path, 'w').write(content)
print("✓ pbxproj modifié — Dummy.swift ajouté au projet")
PYEOF

echo ""
echo "→ Nettoyage DerivedData..."
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/PatriMoiApp-"* 2>/dev/null || true
echo "✓ DerivedData nettoyé"

echo ""
echo "================================================"
echo "  ✓ Fix v4 appliqué !"
echo ""
echo "  Dans Xcode :"
echo "  1. File > Close Workspace"
echo "  2. File > Open : PatriMoiApp.xcworkspace"
echo "  3. ⇧⌘K (Clean Build Folder)"
echo "  4. ▶ Run"
echo "================================================"
read -p "Entrée pour fermer..."
