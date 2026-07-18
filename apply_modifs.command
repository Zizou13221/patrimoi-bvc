#!/bin/bash
SRC=~/Claude/Projects/PatriMoi
DST=~/PatriMoiApp

echo "Copie des fichiers modifiés vers $DST..."

# Pages
# Racine — PatriMoi_Native.jsx (AN_001 fix: setPage reset au login/démo)
cp "$SRC/PatriMoi_Native.jsx"          "$DST/PatriMoi_Native.jsx"          && echo "✓ PatriMoi_Native.jsx (AN_001)"

# Components (AN_006 fix: axes SparklineInteractive)
cp "$SRC/src/components/shared.jsx"    "$DST/src/components/shared.jsx"    && echo "✓ shared.jsx (AN_006)"

cp "$SRC/src/pages/PageAPropos.jsx"    "$DST/src/pages/PageAPropos.jsx"    && echo "✓ PageAPropos.jsx"
cp "$SRC/src/pages/PageDashboard.jsx"  "$DST/src/pages/PageDashboard.jsx"  && echo "✓ PageDashboard.jsx (timestamps BVC/Or)"
cp "$SRC/src/pages/PageConseils.jsx"   "$DST/src/pages/PageConseils.jsx"   && echo "✓ PageConseils.jsx"
cp "$SRC/src/pages/PageActifs.jsx"     "$DST/src/pages/PageActifs.jsx"     && echo "✓ PageActifs.jsx"
cp "$SRC/src/pages/PageParams.jsx"     "$DST/src/pages/PageParams.jsx"     2>/dev/null && echo "✓ PageParams.jsx"
cp "$SRC/src/pages/PageProverbe.jsx"   "$DST/src/pages/PageProverbe.jsx"   2>/dev/null && echo "✓ PageProverbe.jsx"
cp "$SRC/src/pages/PageOnboarding.jsx" "$DST/src/pages/PageOnboarding.jsx" 2>/dev/null && echo "✓ PageOnboarding.jsx"
cp "$SRC/src/pages/PageAuth.jsx"       "$DST/src/pages/PageAuth.jsx"       2>/dev/null && echo "✓ PageAuth.jsx"

# Components
mkdir -p "$DST/src/components"
cp "$SRC/src/components/ErrorBoundary.jsx" "$DST/src/components/ErrorBoundary.jsx" 2>/dev/null && echo "✓ ErrorBoundary.jsx"
cp "$SRC/src/components/shared.jsx"        "$DST/src/components/shared.jsx"        2>/dev/null && echo "✓ shared.jsx"

# CRITIQUE: supprimer les .ts/.tsx de nos fichiers .js
# Metro résout .ts avant .js — si auth.ts existe, notre auth.js est ignoré !
for f in auth supabase keychainStorage syncQueue api sentry storage calc fmt history migrations conseils; do
  rm -f "$DST/src/utils/${f}.ts"  "$DST/src/utils/${f}.tsx"
done
echo "✓ .ts/.tsx conflictuels supprimés de src/utils/"

# CRITIQUE: supprimer patrimoineStore.ts du store
# Le .ts importe dataSlice/authSlice/historySlice (inexistants dans PatriMoiApp)
# → "Requiring unknown module undefined" au runtime
# Metro doit utiliser patrimoineStore.js (version autonome sans slices)
rm -f "$DST/src/store/patrimoineStore.ts" "$DST/src/store/patrimoineStore.tsx"
echo "✓ store/patrimoineStore.ts supprimé (Metro utilisera .js)"

# Copier patrimoineStore.js (contient setDataRaw — OBLIGATOIRE)
mkdir -p "$DST/src/store"
cp "$SRC/src/store/patrimoineStore.js" "$DST/src/store/patrimoineStore.js" && echo "✓ store/patrimoineStore.js (setDataRaw)"

# Utils
cp "$SRC/src/utils/syncQueue.js"       "$DST/src/utils/syncQueue.js"       && echo "✓ syncQueue.js (flush promise fix)"
cp "$SRC/src/utils/api.js"             "$DST/src/utils/api.js"             && echo "✓ api.js (var_pct fallback variation)"
cp "$SRC/src/utils/sentry.js"          "$DST/src/utils/sentry.js"          && echo "✓ sentry.js (stub)"
cp "$SRC/src/utils/auth.js"            "$DST/src/utils/auth.js"            && echo "✓ auth.js"
cp "$SRC/src/utils/supabase.js"        "$DST/src/utils/supabase.js"        && echo "✓ supabase.js"
cp "$SRC/src/utils/storage.js"         "$DST/src/utils/storage.js"         && echo "✓ storage.js"
cp "$SRC/src/utils/calc.js"            "$DST/src/utils/calc.js"            && echo "✓ calc.js"
cp "$SRC/src/utils/fmt.js"             "$DST/src/utils/fmt.js"             && echo "✓ fmt.js"
cp "$SRC/src/utils/history.js"         "$DST/src/utils/history.js"         && echo "✓ history.js"
cp "$SRC/src/utils/migrations.js"      "$DST/src/utils/migrations.js"      && echo "✓ migrations.js"
cp "$SRC/src/utils/conseils.js"        "$DST/src/utils/conseils.js"        && echo "✓ conseils.js"
cp "$SRC/src/utils/keychainStorage.js" "$DST/src/utils/keychainStorage.js" && echo "✓ keychainStorage.js"

# Store slices (modifiés)
mkdir -p "$DST/src/store/slices"
cp "$SRC/src/store/slices/uiSlice.ts"  "$DST/src/store/slices/uiSlice.ts"  && echo "✓ store/slices/uiSlice.ts"

# Constants (manquants dans PatriMoiApp)
mkdir -p "$DST/src/constants"
cp "$SRC/src/constants/colors.js"      "$DST/src/constants/colors.js"      && echo "✓ constants/colors.js"
cp "$SRC/src/constants/data.js"        "$DST/src/constants/data.js"        && echo "✓ constants/data.js"

# Schemas — stub sans zod (zod n'est pas installé dans PatriMoiApp)
mkdir -p "$DST/src/schemas"
# CRITIQUE: supprimer index.ts AVANT d'écrire index.js
# Metro résout .ts avant .js → si index.ts existe et throw, auth.js factory avorte
rm -f "$DST/src/schemas/index.ts"
rm -f "$DST/src/schemas/index.tsx"
cat > "$DST/src/schemas/index.js" << 'SCHEMAEOF'
// Stub schemas/index.js — zod non requis (validation désactivée)
export const PatrimoineDataSchema = null;
export function safeParse(_schema, data) { return data; }
SCHEMAEOF
echo "✓ schemas/index.js (stub sans zod, index.ts supprimé)"

# Racine — supprimer d'abord les .ts/.tsx qui pourraient shadower nos fichiers
rm -f "$DST/PatriMoi_Native.ts" "$DST/PatriMoi_Native.tsx"
rm -f "$DST/index.ts" "$DST/index.tsx"
cp "$SRC/PatriMoi_Native.jsx"          "$DST/PatriMoi_Native.jsx"          && echo "✓ PatriMoi_Native.jsx"
cp "$SRC/index.js"                     "$DST/index.js"                     && echo "✓ index.js (→ PatriMoi_Native)"

# AppNavigator.tsx — toujours vers src/navigation (ne jamais chercher dans node_modules)
mkdir -p "$DST/src/navigation"
cp "$SRC/src/navigation/AppNavigator.tsx" "$DST/src/navigation/AppNavigator.tsx" && echo "✓ AppNavigator.tsx → src/navigation/"

# Navigation ref et types
cp "$SRC/src/navigation/navigationRef.ts"  "$DST/src/navigation/navigationRef.ts"  2>/dev/null && echo "✓ navigationRef.ts"
cp "$SRC/src/navigation/types.ts"          "$DST/src/navigation/types.ts"           2>/dev/null && echo "✓ types.ts"

# Module natif custom PDF (à ajouter manuellement à l'app target Xcode)
IOS_TARGET="$DST/ios/PatriMoiApp"
if [ -d "$IOS_TARGET" ]; then
  cp "$SRC/ios_native/RNPDFExport.h" "$IOS_TARGET/RNPDFExport.h" && echo "✓ RNPDFExport.h → ios/PatriMoiApp/"
  cp "$SRC/ios_native/RNPDFExport.m" "$IOS_TARGET/RNPDFExport.m" && echo "✓ RNPDFExport.m → ios/PatriMoiApp/"
  echo ""
  echo "⚠️  ÉTAPE XCODE REQUISE (une seule fois) :"
  echo "   1. Dans Xcode → PatriMoiApp (target) → clic droit → 'Add Files to PatriMoiApp'"
  echo "   2. Sélectionne RNPDFExport.h et RNPDFExport.m"
  echo "   3. Coche 'Add to target: PatriMoiApp' → Add"
  echo "   4. Build & Run (⌘R)"
  echo "   → NativeModules.RNPDFExport sera disponible → PDF natif activé"
else
  echo "⚠️  Dossier ios/PatriMoiApp non trouvé — copie manuelle requise"
fi

echo ""
echo "Fait ! Lance Metro avec reset-cache :"
echo "  cd ~/PatriMoiApp && npx react-native start --reset-cache"
