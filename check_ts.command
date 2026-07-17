#!/bin/bash
echo "=== FICHIERS src/utils dans PatriMoiApp ==="
ls -la ~/PatriMoiApp/src/utils/
echo ""
echo "=== PREMIERE LIGNE de auth.ts (si existe) ==="
head -3 ~/PatriMoiApp/src/utils/auth.ts 2>/dev/null || echo "auth.ts : ABSENT"
echo ""
echo "=== PREMIERE LIGNE de supabase.ts (si existe) ==="
head -3 ~/PatriMoiApp/src/utils/supabase.ts 2>/dev/null || echo "supabase.ts : ABSENT"
read -p "Entrée pour fermer..."
