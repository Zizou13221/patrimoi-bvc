#!/bin/bash
cd "$HOME/PatriMoiApp"
echo "================================================"
echo "  PatriMoi — Démarrage Metro Bundler"
echo "================================================"
echo ""
echo "Metro va démarrer sur le port 8081."
echo "Laisse cette fenêtre ouverte pendant que tu testes l'app."
echo ""
npx react-native start --reset-cache
