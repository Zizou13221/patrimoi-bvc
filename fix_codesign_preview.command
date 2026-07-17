#!/bin/bash
set -e
APP="$HOME/PatriMoiApp"
PBXPROJ="$APP/ios/PatriMoiApp.xcodeproj/project.pbxproj"

echo "=== Fix CodeSign __preview.dylib — ENABLE_PREVIEWS = NO ==="

# Backup
cp "$PBXPROJ" "$PBXPROJ.bak_codesign"
echo "✓ Backup: project.pbxproj.bak_codesign"

# Check current state
echo ""
echo "▸ État actuel ENABLE_PREVIEWS:"
grep -n "ENABLE_PREVIEWS" "$PBXPROJ" || echo "  (pas trouvé)"

# Add ENABLE_PREVIEWS = NO to all XCBuildConfiguration buildSettings blocks
# Using ruby for reliable multi-line pbxproj editing
ruby - "$PBXPROJ" <<'RUBY'
content = File.read(ARGV[0])

# Add ENABLE_PREVIEWS = NO after ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES if present
# or after CODE_SIGN_STYLE otherwise
# Simple approach: add to every buildSettings block that doesn't already have it

modified = content.gsub(/\bEnable_PREVIEWS\b/, 'ENABLE_PREVIEWS')

# For each buildSettings = { block, if ENABLE_PREVIEWS not present, add it
# We'll add after ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES or at end of buildSettings
result = content.gsub(/(\t\t\t\tbuildSettings = \{[^}]*?)(^\t\t\t\t\};)/m) do |match|
  settings_block = $1
  closing = $2
  if settings_block.include?('ENABLE_PREVIEWS')
    match
  else
    settings_block + "\t\t\t\t\tENABLE_PREVIEWS = NO;\n" + closing
  end
end

File.write(ARGV[0], result)
puts "✓ ENABLE_PREVIEWS = NO ajouté à tous les blocs buildSettings"
RUBY

echo ""
echo "▸ Vérification:"
grep -n "ENABLE_PREVIEWS" "$PBXPROJ" | head -10

echo ""
echo "=== TERMINE ==="
echo "Dans Xcode: Product → Clean Build Folder (Shift+Cmd+K) puis Run (Cmd+R)"
