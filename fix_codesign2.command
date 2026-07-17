#!/bin/bash
set -e
APP="$HOME/PatriMoiApp"
PBXPROJ="$APP/ios/PatriMoiApp.xcodeproj/project.pbxproj"

echo "=== Fix Sign __preview.dylib — Add delete script phase ==="
cp "$PBXPROJ" "$PBXPROJ.bak_codesign2"
echo "✓ Backup créé"

ruby - "$PBXPROJ" <<'RUBY'
content = File.read(ARGV[0])

# Check if already added
if content.include?('Delete __preview.dylib')
  puts "✓ Phase déjà présente, rien à faire"
  exit 0
end

# Generate a unique UUID for the new build phase
require 'securerandom'
new_uuid = SecureRandom.hex(12).upcase

# The shell script phase to add
new_phase = <<~PHASE
		#{new_uuid} /* Delete __preview.dylib */ = {
			isa = PBXShellScriptBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			inputFileListPaths = (
			);
			inputPaths = (
			);
			name = "Delete __preview.dylib";
			outputFileListPaths = (
			);
			outputPaths = (
			);
			runOnlyForDeploymentPostprocessing = 0;
			shellPath = /bin/sh;
			shellScript = "find \\"${BUILT_PRODUCTS_DIR}\\" -name \\"__preview.dylib\\" -delete 2>/dev/null; exit 0\\n";
		};
PHASE

# Insert the new phase into /* Begin PBXShellScriptBuildPhase section */
if content.include?('/* Begin PBXShellScriptBuildPhase section */')
  content = content.sub(
    '/* Begin PBXShellScriptBuildPhase section */',
    "/* Begin PBXShellScriptBuildPhase section */\n" + new_phase
  )
else
  # No existing shell script phase — add a new section before /* End PBXNativeTarget section */
  content = content.sub(
    '/* Begin PBXNativeTarget section */',
    "/* Begin PBXShellScriptBuildPhase section */\n" + new_phase + "\t\t/* End PBXShellScriptBuildPhase section */\n\n\t\t/* Begin PBXNativeTarget section */"
  )
end

# Add the phase UUID to the PatriMoiApp target's buildPhases list
# Find the PatriMoiApp native target and insert before the last entry of buildPhases
content = content.sub(
  /(name = PatriMoiApp;.*?buildPhases = \([^)]*?)(^\t\t\t\);)/m
) do |match|
  before = $1
  closing = $2
  before + "\t\t\t\t#{new_uuid} /* Delete __preview.dylib */,\n" + closing
end

File.write(ARGV[0], content)
puts "✓ Phase 'Delete __preview.dylib' ajoutée (UUID: #{new_uuid})"
RUBY

echo ""
echo "=== Vérification ==="
grep -n "Delete __preview.dylib\|ENABLE_PREVIEWS" "$PBXPROJ" | head -10
echo ""
echo "Dans Xcode: Product → Clean Build Folder, puis Cmd+R"
echo "=== TERMINE ==="
