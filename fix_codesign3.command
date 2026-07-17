#!/bin/bash
set -e

PBXPROJ="$HOME/PatriMoiApp/ios/PatriMoiApp.xcodeproj/project.pbxproj"

echo "=== Fix CodeSign 3: CODE_SIGNING_ALLOWED[sdk=iphonesimulator*] = NO ==="
cp "$PBXPROJ" "$PBXPROJ.bak_codesign3"
echo "✓ Backup créé"

ruby - "$PBXPROJ" <<'RUBY'
content = File.read(ARGV[0])

if content.include?('CODE_SIGNING_ALLOWED[sdk=iphonesimulator')
  puts "✓ Déjà présent, rien à faire"
  exit 0
end

# Add CODE_SIGNING_ALLOWED[sdk=iphonesimulator*] = NO to every buildSettings block.
# This prevents Xcode from signing __preview.dylib on simulator builds.
# Existing device builds are unaffected.
count = 0
new_content = content.gsub(/(buildSettings = \{)/) do
  count += 1
  "#{$1}\n\t\t\t\tCODE_SIGNING_ALLOWED[sdk=iphonesimulator*] = NO;"
end

puts "Ajouté dans #{count} blocs buildSettings"
File.write(ARGV[0], new_content)
RUBY

echo ""
echo "=== Vérification ==="
grep -c "CODE_SIGNING_ALLOWED\[sdk=iphonesimulator" "$PBXPROJ"
echo "occurrences trouvées"
echo ""
echo "Dans Xcode: Product → Clean Build Folder (Shift+Cmd+K), puis Cmd+R"
echo "=== TERMINE ==="
