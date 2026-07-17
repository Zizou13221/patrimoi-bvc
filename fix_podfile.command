#!/bin/bash
set -e
PODFILE="$HOME/PatriMoiApp/ios/Podfile"
WORKSPACE="$HOME/Claude/Projects/PatriMoi"

echo "=== Fix Podfile — double post_install ==="

# 1. Backup + export pour lecture
cp "$PODFILE" "${PODFILE}.bak"
cp "$PODFILE" "$WORKSPACE/podfile_current.txt"
echo "✓ Backup: ${PODFILE}.bak"
echo "✓ Copie dans workspace pour reference"

# 2. Patch Ruby : merger les post_install en un seul block
ruby << 'RUBY'
require 'fileutils'

path = File.expand_path("~/PatriMoiApp/ios/Podfile")
content = File.read(path)

# Extraire le contenu de chaque post_install block
blocks = []
content.scan(/^post_install do \|installer\|(.*?)^end\n?/m) do |m|
  blocks << m[0].strip
end

puts "Blocs post_install trouves: #{blocks.length}"

if blocks.length <= 1
  puts "Rien a merger (#{blocks.length} block)"
  exit 0
end

# Supprimer tous les post_install blocks du contenu
clean = content.gsub(/^post_install do \|installer\|.*?^end\n?/m, '').rstrip

# Merger tous les contenus en un seul block
merged_body = blocks.join("\n  ")
merged = "\npost_install do |installer|\n  #{merged_body}\nend\n"

File.write(path, clean + merged)
puts "✓ Podfile patche — #{blocks.length} blocs merges en 1"
RUBY

echo ""
echo "=== Reinstallation des pods ==="
cd "$HOME/PatriMoiApp/ios"
pod install --silent 2>&1 | grep -v "^$" | tail -20

echo ""
echo "=== TERMINE ==="
echo "Maintenant dans Xcode: Product → Clean Build Folder (Cmd+Shift+K)"
echo "puis Run (Cmd+R) pour rebuilder avec le module PDF lie."
