#!/bin/bash
# Active le Simulator et prend une capture
osascript -e 'tell application "Simulator" to activate'
sleep 1
# Screenshot du simulateur
xcrun simctl io booted screenshot /tmp/simulator_screen.png 2>/dev/null && \
  open /tmp/simulator_screen.png || \
  echo "Erreur screenshot simulateur"
