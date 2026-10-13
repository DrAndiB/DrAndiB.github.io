// UI translations: Deutsch, English, Français.
// Stored values (genders, categories, breeding codes) stay language-neutral keys; only labels are translated.

export const LANGS = { de: "Deutsch", en: "English", fr: "Français" };
const LOCALE = { de: "de-DE", en: "en-GB", fr: "fr-FR" };

const S = {
  "nav.capture": ["Erfassen", "Record", "Saisir"],
  "nav.list": ["Sichtungen", "Sightings", "Observations"],
  "nav.map": ["Karte", "Map", "Carte"],
  "nav.settings": ["Einstellungen", "Settings", "Réglages"],
  "close": ["Schließen", "Close", "Fermer"],
  "cancel": ["Abbrechen", "Cancel", "Annuler"],

  "gps.none": ["Kein GPS", "No GPS", "Pas de GPS"],
  "gps.ok": ["GPS OK", "GPS OK", "GPS OK"],
  "acc.high": ["Genauigkeit hoch ±{m} m", "Accuracy high ±{m} m", "Précision élevée ±{m} m"],
  "acc.mid": ["Genauigkeit mittel ±{m} m", "Accuracy medium ±{m} m", "Précision moyenne ±{m} m"],
  "acc.low": ["Genauigkeit schwach ±{m} m", "Accuracy low ±{m} m", "Précision faible ±{m} m"],
  "acc.none": ["Genauigkeit schwach", "Accuracy low", "Précision faible"],
  "gps.wait": ["Warte auf Standort …", "Waiting for your location …", "En attente de la position …"],
  "gps.denied": ["Standortzugriff verweigert – in den Browser-Einstellungen erlauben.", "Location access denied – allow it in your browser settings.", "Accès à la position refusé – autorisez-le dans les réglages du navigateur."],
  "gps.searching": ["Standort wird gesucht …", "Finding your location …", "Recherche de la position …"],
  "gps.unsupported": ["Kein GPS in diesem Browser", "No location support in this browser", "Pas de géolocalisation dans ce navigateur"],
  "alt": ["m ü. NN", "m a.s.l.", "m d'altitude"],
  "N": ["N", "N", "N"], "S": ["S", "S", "S"], "E": ["O", "E", "E"], "W": ["W", "W", "O"],

  "dial.label": ["Richtung der Sichtung", "Direction of the sighting", "Direction de l'observation"],
  "hdg.sensor": ["Kompass aktiv – Gerät oder Kamera auf die Sichtung richten", "Compass active – point the phone or its camera at the sighting", "Boussole active – orientez le téléphone ou l'objectif vers l'observation"],
  "hdg.manual": ["Richtung von Hand eingestellt", "Direction set by hand", "Direction réglée à la main"],
  "hdg.none": ["Kein Kompass-Sensor – Richtung durch Ziehen am Kompass einstellen", "No compass sensor – drag the compass to set the direction", "Pas de boussole – faites tourner la rose pour régler la direction"],
  "hdg.needsPerm": ["Kompass muss einmal freigegeben werden", "The compass needs your permission once", "La boussole doit être autorisée une fois"],
  "hdg.enable": ["Kompass aktivieren", "Enable compass", "Activer la boussole"],
  "hdg.useSensor": ["Kompass-Sensor verwenden", "Use compass sensor", "Utiliser la boussole"],
  "hdg.decl": ["Missweisung {d}° berücksichtigt", "Declination {d}° applied", "Déclinaison {d}° appliquée"],
  "hdg.denied": ["Kompass-Zugriff wurde nicht erlaubt.", "Compass access was not allowed.", "L'accès à la boussole n'a pas été autorisé."],
  "bearing.save": ["Zugrichtung speichern", "Record flight direction", "Enregistrer la direction de vol"],
  "bearing.saved": ["Zugrichtung {b}° ({p}) gespeichert", "Flight direction {b}° ({p}) recorded", "Direction de vol {b}° ({p}) enregistrée"],

  "dist.label": ["Abstand der Sichtung", "Distance to the sighting", "Distance de l'observation"],
  "proj.here": ["Die Sichtung wird an deinem Standort gespeichert.", "The sighting is saved at your position.", "L'observation est enregistrée à votre position."],
  "proj.away": ["Die Sichtung wird {d} in Richtung {h}° ({p}) von deinem Standort eingetragen.", "The sighting is placed {d} from you, towards {h}° ({p}).", "L'observation est placée à {d} de vous, en direction {h}° ({p})."],

  "quick.label": ["Schnelleingabe", "Quick entry", "Saisie rapide"],
  "quick.ph": ["z. B. 3 Rotmilane überfliegend", "e.g. 3 red kites flying over", "p. ex. 3 milans royaux en vol"],
  "quick.apply": ["Übernehmen", "Apply", "Appliquer"],
  "quick.mic": ["Spracheingabe", "Voice entry", "Saisie vocale"],
  "quick.listening": ["Höre zu …", "Listening …", "À l'écoute …"],
  "quick.none": ["Keine Art erkannt", "No species recognised", "Aucune espèce reconnue"],
  "quick.voiceErr": ["Spracheingabe ist hier nicht verfügbar.", "Voice entry isn't available here.", "La saisie vocale n'est pas disponible ici."],
  "quick.applied": ["Formular ausgefüllt – prüfen und speichern", "Form filled in – check and save", "Formulaire rempli – vérifiez et enregistrez"],

  "species.eyebrow": ["Art", "Species", "Espèce"],
  "species.choose": ["Art wählen", "Choose species", "Choisir l'espèce"],
  "species.hint": ["Tippen, um Vogel- oder Tierart zu suchen", "Tap to search for a bird or other species", "Touchez pour chercher un oiseau ou une autre espèce"],
  "deOnly": ["", "German name only", "nom allemand uniquement"],
  "recent": ["Zuletzt", "Recent", "Récentes"],
  "count": ["Anzahl", "Count", "Nombre"],
  "gender": ["Geschlecht / Code", "Sex / code", "Sexe / code"],
  "breeding": ["Brutzeitcode", "Breeding code", "Code nicheur"],
  "breeding.none": ["– kein Code –", "– no code –", "– aucun code –"],
  "comment": ["Kommentar", "Comment", "Commentaire"],
  "comment.ph": ["z. B. singend, überfliegend", "e.g. singing, flying over", "p. ex. chanteur, en vol"],
  "save": ["Sichtung speichern", "Save sighting", "Enregistrer"],
  "pickOnMap": ["Auf Karte setzen", "Place on map", "Placer sur la carte"],
  "less": ["Eins weniger", "One fewer", "Un de moins"],
  "more": ["Eins mehr", "One more", "Un de plus"],

  "walk.start": ["Begehung starten", "Start survey walk", "Démarrer un relevé"],
  "walk.stop": ["Beenden", "Stop", "Terminer"],
  "walk.running": ["Begehung · {d} · {t} · {n}", "Walk · {d} · {t} · {n}", "Relevé · {d} · {t} · {n}"],
  "walk.started": ["Begehung gestartet – der Bildschirm bleibt an.", "Survey walk started – the screen stays on.", "Relevé démarré – l'écran reste allumé."],
  "walk.ended": ["Begehung beendet: {d}, {n}", "Walk finished: {d}, {n}", "Relevé terminé : {d}, {n}"],
  "walk.note": ["Der Track wird nur aufgezeichnet, solange die App offen und der Bildschirm an ist.", "The track only records while the app is open and the screen is on.", "Le tracé n'est enregistré que lorsque l'appli est ouverte et l'écran allumé."],
  "walk.name": ["Begehung {date}", "Survey walk {date}", "Relevé {date}"],

  "toast.saved": ["Sichtung gespeichert: {n}× {s}", "Sighting saved: {n}× {s}", "Observation enregistrée : {n}× {s}"],
  "toast.savedPlain": ["Sichtung wurde gespeichert", "Sighting saved", "Observation enregistrée"],
  "err.noGps": ["Ohne GPS-Signal kann nicht gespeichert werden. Mit „Auf Karte setzen“ wählst du den Fundort von Hand.", "Can't save without a GPS fix. Use “Place on map” to set the spot by hand.", "Impossible d'enregistrer sans GPS. Utilisez « Placer sur la carte » pour choisir le lieu."],
  "err.noSpecies": ["Bitte zuerst eine Art wählen.", "Choose a species first.", "Choisissez d'abord une espèce."],
  "err.storage": ["Speicher voll oder gesperrt – die Sichtung wurde nicht gespeichert.", "Storage is full or blocked – the sighting was not saved.", "Stockage plein ou bloqué – l'observation n'a pas été enregistrée."],

  "sum.sightings": ["Sichtungen", "sightings", "observations"],
  "sum.sighting1": ["Sichtung", "sighting", "observation"],
  "sum.species": ["Arten", "Species", "Espèces"],
  "sum.today": ["heute", "today", "aujourd'hui"],
  "list.export": ["Exportieren & senden", "Export & send", "Exporter et envoyer"],
  "list.clear": ["Alle löschen", "Delete all", "Tout supprimer"],
  "list.clearQ": ["Möchtest du wirklich alle {n} Sichtungen löschen? Das lässt sich nicht rückgängig machen.", "Delete all {n} sightings? This can't be undone.", "Supprimer les {n} observations ? Cette action est définitive."],
  "list.clearYes": ["Ja, alle löschen", "Yes, delete all", "Oui, tout supprimer"],
  "list.cleared": ["Alle Sichtungen gelöscht", "All sightings deleted", "Toutes les observations ont été supprimées"],
  "empty.title": ["Noch keine Sichtungen", "No sightings yet", "Aucune observation"],
  "empty.text": ["Erfasse die erste Beobachtung im Tab „Erfassen“ oder drücke auf der Karte lange auf den Fundort.", "Record your first sighting in the Record tab, or long-press the spot on the map.", "Saisissez votre première observation dans l'onglet Saisir, ou appuyez longuement sur le lieu dans la carte."],
  "empty.example": ["Beispieldaten ansehen", "See example data", "Voir des exemples"],
  "example.banner": ["Du siehst Beispieldaten von einer Begehung am Haff Réimech (Luxemburg).", "You're looking at example data from a survey walk at Haff Réimech, Luxembourg.", "Vous voyez des exemples issus d'un relevé au Haff Réimech (Luxembourg)."],
  "example.remove": ["Beispiele entfernen", "Remove examples", "Supprimer les exemples"],
  "example.loaded": ["Beispieldaten geladen", "Example data loaded", "Exemples chargés"],
  "backup.banner": ["Letzte Sicherung: {when}. {n} Sichtungen gibt es nur auf diesem Gerät.", "Last backup: {when}. {n} sightings exist only on this device.", "Dernière sauvegarde : {when}. {n} observations n'existent que sur cet appareil."],
  "backup.never": ["noch nie", "never", "jamais"],
  "backup.now": ["Jetzt sichern", "Back up now", "Sauvegarder"],
  "install.hint": ["Tipp: Zum Home-Bildschirm hinzufügen. Dann löscht der Browser deine Daten nicht.", "Tip: add the app to your home screen so the browser keeps your data.", "Astuce : ajoutez l'appli à l'écran d'accueil pour que le navigateur conserve vos données."],

  "map.hint": ["Lange drücken (oder Rechtsklick), um hier eine Sichtung hinzuzufügen.", "Long-press (or right-click) to add a sighting here.", "Appui long (ou clic droit) pour ajouter une observation ici."],
  "map.pick": ["Tippe auf den Fundort.", "Tap the spot where you saw it.", "Touchez le lieu de l'observation."],
  "map.addQ": ["Sichtung hinzufügen?", "Add a sighting?", "Ajouter une observation ?"],
  "map.new": ["Neue Sichtung", "New sighting", "Nouvelle observation"],
  "map.locate": ["Zu meinem Standort", "Go to my location", "Aller à ma position"],
  "map.me": ["Mein Standort", "My location", "Ma position"],
  "map.noFix": ["Noch kein Standort verfügbar.", "No location yet.", "Pas encore de position."],
  "map.edit": ["Bearbeiten", "Edit", "Modifier"],
  "map.count": ["Anzahl", "Count", "Nombre"],
  "map.failed": ["Karte konnte nicht geladen werden.", "The map could not be loaded.", "La carte n'a pas pu être chargée."],
  "layer.normal": ["Normal", "Standard", "Standard"],
  "layer.satellite": ["Satellit", "Satellite", "Satellite"],
  "layer.hybrid": ["Hybrid", "Hybrid", "Hybride"],
  "layer.topo": ["Topographisch", "Topographic", "Topographique"],

  "edit.title": ["Sichtung bearbeiten", "Edit sighting", "Modifier l'observation"],
  "edit.new": ["Neue Sichtung", "New sighting", "Nouvelle observation"],
  "edit.time": ["Zeitpunkt", "Date & time", "Date et heure"],
  "edit.quick": ["Schnelle Kommentare", "Quick comments", "Commentaires rapides"],
  "edit.save": ["Speichern", "Save", "Enregistrer"],
  "edit.map": ["Karte", "Map", "Carte"],
  "edit.delete": ["Löschen", "Delete", "Supprimer"],
  "edit.deleteQ": ["Diese Sichtung löschen?", "Delete this sighting?", "Supprimer cette observation ?"],
  "edit.deleted": ["Sichtung gelöscht", "Sighting deleted", "Observation supprimée"],
  "edit.noAlt": ["Keine Höhenangabe vom GPS verfügbar.", "No altitude from GPS.", "Pas d'altitude fournie par le GPS."],
  "edit.where": ["{d} in Richtung {h}° vom Standort", "{d} from the observer towards {h}°", "à {d} de l'observateur, direction {h}°"],
  "q.time": ["Uhrzeit", "Time", "Heure"],
  "q.alt": ["Höhe", "Altitude", "Altitude"],
  "q.win": ["Zugrichtung", "Flight direction", "Direction de vol"],
  "q.CODREV": ["Code Revier", "Code territory", "Code territoire"],
  "q.CODNEST": ["Code Nest", "Code nest", "Code nid"],
  "q.CODADULT": ["Code Adult", "Code adult", "Code adulte"],
  "q.CODJUV": ["Code Juvenile", "Code juvenile", "Code juvénile"],
  "q.CODPUL": ["Code Pullus", "Code pullus", "Code poussin"],
  "q.CODBP": ["Code Brutpaar", "Code breeding pair", "Code couple nicheur"],

  "search.ph": ["Name, Abkürzung oder wissenschaftlich", "Name, abbreviation or scientific name", "Nom, abréviation ou nom scientifique"],
  "search.recent": ["Zuletzt gewählt", "Recently chosen", "Choisies récemment"],
  "search.type": ["Namen, wissenschaftlichen Namen oder Abkürzung eintippen", "Type a name, scientific name or abbreviation", "Tapez un nom, un nom scientifique ou une abréviation"],
  "search.hits": ["{n} Treffer", "{n} matches", "{n} résultats"],
  "search.many": ["Über 60 Treffer", "More than 60 matches", "Plus de 60 résultats"],
  "search.none": ["Keine Art gefunden", "No species found", "Aucune espèce trouvée"],
  "search.lists": ["Artlisten", "Species lists", "Listes d'espèces"],
  "abbr": ["Abkürzung", "Abbreviation", "Abréviation"],

  "cat.BIRD": ["Vögel", "Birds", "Oiseaux"],
  "cat.AMPHIBIAN": ["Amphibien & Reptilien", "Amphibians & reptiles", "Amphibiens & reptiles"],
  "cat.INSECT": ["Tagfalter & Libellen", "Butterflies & dragonflies", "Papillons & libellules"],
  "cat.MAMMAL": ["Säugetiere", "Mammals", "Mammifères"],

  "g.Unbekannt": ["Unbekannt", "Unknown", "Inconnu"],
  "g.Männchen": ["Männchen", "Male", "Mâle"],
  "g.Weibchen": ["Weibchen", "Female", "Femelle"],
  "g.Jungtier": ["Jungtier", "Juvenile", "Juvénile"],
  "g.Pullus": ["Pullus", "Pullus (nestling)", "Poussin"],
  "g.Adult": ["Adult", "Adult", "Adulte"],
  "g.Subadult": ["Subadult", "Subadult", "Subadulte"],
  "g.Brutpaar": ["Brutpaar", "Breeding pair", "Couple nicheur"],
  "g.Nest": ["Nest", "Nest", "Nid"],
  "g.Revier": ["Revier", "Territory", "Territoire"],

  "bc.A": ["A – möglich", "A – possible", "A – possible"],
  "bc.B": ["B – wahrscheinlich", "B – probable", "B – probable"],
  "bc.C": ["C – sicher", "C – confirmed", "C – certain"],
  "bc.A1": ["im Bruthabitat beobachtet", "seen in suitable breeding habitat", "observé dans un habitat favorable"],
  "bc.A2": ["singendes Männchen, Balzrufe", "singing male or breeding calls", "mâle chanteur, cris nuptiaux"],
  "bc.B3": ["Paar im Bruthabitat", "pair in suitable habitat", "couple dans un habitat favorable"],
  "bc.B4": ["Revier an 2 Tagen bestätigt", "territory on 2 different days", "territoire sur 2 jours différents"],
  "bc.B5": ["Balz", "courtship or display", "parade nuptiale"],
  "bc.B6": ["sucht wahrscheinlichen Nistplatz auf", "visiting probable nest site", "visite d'un site de nid probable"],
  "bc.B7": ["Warnrufe, Erregung", "agitated behaviour, alarm calls", "comportement agité, cris d'alarme"],
  "bc.B8": ["Brutfleck", "brood patch", "plaque incubatrice"],
  "bc.B9": ["Nestbau", "nest building", "construction du nid"],
  "bc.C10": ["Verleiten, Ablenkung", "distraction display", "comportement de diversion"],
  "bc.C11": ["benutztes Nest, Eischalen", "used nest or eggshells", "nid utilisé, coquilles"],
  "bc.C12": ["eben flügge Junge", "recently fledged young", "jeunes récemment envolés"],
  "bc.C13": ["fliegt Nest an, brütet", "adult at occupied nest, incubating", "adulte au nid occupé, couvant"],
  "bc.C14": ["trägt Futter oder Kotballen", "carrying food or faecal sac", "transporte nourriture ou sac fécal"],
  "bc.C15": ["Nest mit Eiern", "nest with eggs", "nid avec œufs"],
  "bc.C16": ["Nest mit Jungen", "nest with young", "nid avec jeunes"],

  "export.title": ["Exportieren & senden", "Export & send", "Exporter et envoyer"],
  "fmt.miniavi": ["beobachtungen.asc · nur Vögel · Koordinaten im NMEA-Format", "beobachtungen.asc · birds only · NMEA coordinates", "beobachtungen.asc · oiseaux uniquement · coordonnées NMEA"],
  "fmt.csv": ["beobachtungen.csv · mit UTM-Rechts-/Hochwert", "beobachtungen.csv · with UTM easting/northing", "beobachtungen.csv · avec coordonnées UTM"],
  "fmt.ebird": ["ebird-import.csv · eBird-Record-Format zum Import, nur Vögel", "ebird-import.csv · eBird Record Format for upload, birds only", "ebird-import.csv · format eBird Record pour l'import, oiseaux uniquement"],
  "fmt.gpx": ["androbird.gpx · Wegpunkte und Begehungs-Tracks für GPS-Geräte und GIS", "androbird.gpx · waypoints and walk tracks for GPS devices and GIS", "androbird.gpx · points et tracés des relevés pour GPS et SIG"],
  "fmt.geojson": ["androbird.geojson · für QGIS und Webkarten", "androbird.geojson · for QGIS and web maps", "androbird.geojson · pour QGIS et cartes web"],
  "fmt.backup": ["androbird-sicherung.json · alle Daten, wieder einlesbar", "androbird-backup.json · all data, can be restored", "androbird-sauvegarde.json · toutes les données, restaurables"],
  "fmt.backupName": ["Sicherung", "Backup", "Sauvegarde"],
  "filter": ["Sichtungen filtern", "Filter sightings", "Filtrer les observations"],
  "filter.ALL": ["Alle Sichtungen", "All sightings", "Toutes les observations"],
  "blur": ["Fundorte sensibler Brutvögel auf 1 km vergröbern", "Blur sensitive breeding sites to 1 km", "Flouter à 1 km les sites de nidification sensibles"],
  "export.count1": ["1 Sichtung wird exportiert.", "1 sighting will be exported.", "1 observation sera exportée."],
  "export.count": ["{n} Sichtungen werden exportiert.", "{n} sightings will be exported.", "{n} observations seront exportées."],
  "export.none": ["Keine passenden Sichtungen.", "No matching sightings.", "Aucune observation correspondante."],
  "recipient": ["Empfänger:", "Recipient:", "Destinataire :"],
  "copy": ["Kopieren", "Copy", "Copier"],
  "copied": ["E-Mail-Adresse kopiert", "E-mail address copied", "Adresse e-mail copiée"],
  "share": ["Teilen / per E-Mail senden", "Share / send by e-mail", "Partager / envoyer par e-mail"],
  "download": ["Herunterladen", "Download", "Télécharger"],
  "downloaded": ["{f} heruntergeladen", "{f} downloaded", "{f} téléchargé"],
  "share.renamed": ["Dein Browser teilt {ext}-Dateien nicht direkt. Geteilt wird deshalb {f} – vor dem Import die Endung „.txt“ entfernen. „Herunterladen“ speichert {orig} unverändert.", "Your browser can't share {ext} files directly, so it will share {f}. Remove the “.txt” before importing. “Download” saves {orig} unchanged.", "Votre navigateur ne partage pas les fichiers {ext} directement : il partagera {f}. Retirez « .txt » avant l'import. « Télécharger » enregistre {orig} tel quel."],
  "shareFail": ["Teilen ist hier nicht möglich – bitte herunterladen.", "Sharing isn't possible here – please download.", "Le partage n'est pas possible ici – téléchargez le fichier."],
  "import": ["Sicherung einlesen …", "Restore a backup …", "Restaurer une sauvegarde …"],
  "imported": ["{n} Sichtungen eingelesen", "{n} sightings restored", "{n} observations restaurées"],
  "importFail": ["Die Datei ist keine AndroBird-Sicherung.", "This file is not an AndroBird backup.", "Ce fichier n'est pas une sauvegarde AndroBird."],

  "set.language": ["Sprache", "Language", "Langue"],
  "set.auto": ["Automatisch (Browser)", "Automatic (browser)", "Automatique (navigateur)"],
  "set.user": ["Nutzer", "User", "Utilisateur"],
  "set.username": ["Nutzername", "Name", "Nom"],
  "set.usernameHint": ["Wird im MiniAvi-Export als Beobachter eingetragen.", "Used as the observer name in the MiniAvi export.", "Utilisé comme nom d'observateur dans l'export MiniAvi."],
  "set.email": ["E-Mail-Adresse", "E-mail address", "Adresse e-mail"],
  "set.emailHint": ["Empfänger für exportierte Sichtungen.", "Recipient for exported sightings.", "Destinataire des observations exportées."],
  "set.prog": ["Programm", "App", "Application"],
  "set.maxDistance": ["Maximaler Abstand", "Maximum distance", "Distance maximale"],
  "set.mapType": ["Kartentyp", "Map type", "Type de carte"],
  "set.searchType": ["Suchmodus", "Search mode", "Mode de recherche"],
  "set.names": ["Ganze Namen", "Full names", "Noms complets"],
  "set.abbreviations": ["Abkürzungen zuerst", "Abbreviations first", "Abréviations d'abord"],
  "set.searchHint": ["Abkürzungen gibt es für 283 Vogelarten (z. B. „Ha“ für Habicht).", "283 bird species have German abbreviations (e.g. “Ha” for Northern Goshawk).", "283 espèces d'oiseaux ont une abréviation allemande (p. ex. « Ha » pour l'Autour des palombes)."],
  "set.lists": ["Auswahl der Artlisten", "Species lists", "Listes d'espèces"],
  "set.listsMin": ["Mindestens eine Artliste muss ausgewählt sein.", "Keep at least one species list selected.", "Gardez au moins une liste d'espèces."],
  "set.headingMode": ["Modus für Zugrichtung", "Flight-direction mode", "Mode direction de vol"],
  "set.hmManual": ["Manuell – nach jedem Speichern zurücksetzen", "Manual – reset after each save", "Manuel – réinitialiser après chaque enregistrement"],
  "set.hmDynamic": ["Dynamisch – bleibt eingeschaltet", "Dynamic – stays on", "Dynamique – reste activé"],
  "set.declination": ["Missweisung automatisch korrigieren (WMM 2025)", "Correct magnetic declination automatically (WMM 2025)", "Corriger la déclinaison magnétique (WMM 2025)"],
  "set.keepAwake": ["Bildschirm beim Erfassen anlassen", "Keep the screen on while recording", "Garder l'écran allumé pendant la saisie"],
  "set.auto2": ["Automatische Kommentare & Standardwerte", "Automatic comments & defaults", "Commentaires automatiques et valeurs par défaut"],
  "set.autoTime": ["Uhrzeit automatisch einfügen", "Add the time automatically", "Ajouter l'heure automatiquement"],
  "set.autoAltitude": ["Höhe automatisch einfügen", "Add the altitude automatically", "Ajouter l'altitude automatiquement"],
  "set.defaultCount": ["Anzahl Individuen", "Default count", "Nombre par défaut"],
  "set.defaultGender": ["Standard für Geschlecht / Code", "Default sex / code", "Sexe / code par défaut"],
  "set.defaultComment": ["Standardkommentar", "Default comment", "Commentaire par défaut"],
  "set.saved": ["Einstellungen gespeichert", "Settings saved", "Réglages enregistrés"],
  "about.text": ["Die 2026er Ausgabe der Android-App AndroBird, die 2012 gemeinsam mit meinem Bruder, einem begeisterten Vogelbeobachter, entstand. Alle Sichtungen bleiben in diesem Browser auf diesem Gerät gespeichert. Exportiere regelmäßig eine Sicherung.", "The 2026 edition of the AndroBird Android app, which I built in 2012 with my brother, a keen birder. All sightings stay in this browser on this device. Export a backup regularly.", "L'édition 2026 de l'application Android AndroBird, créée en 2012 avec mon frère, ornithologue passionné. Toutes les observations restent dans ce navigateur, sur cet appareil. Exportez régulièrement une sauvegarde."],
  "about.more": ["Weitere Demos auf andreasbraun.lu", "More demos on andreasbraun.lu", "Autres démos sur andreasbraun.lu"],
  "about.credits": ["Karten © OpenStreetMap-Mitwirkende, OpenTopoMap, Esri. Artnamen EN/FR: BirdNET (CC BY-NC-SA 4.0). Missweisung: World Magnetic Model 2025 (NOAA/BGS). Geodäsie nach Vincenty (WGS84).", "Maps © OpenStreetMap contributors, OpenTopoMap, Esri. English/French species names: BirdNET (CC BY-NC-SA 4.0). Declination: World Magnetic Model 2025 (NOAA/BGS). Geodesy after Vincenty (WGS84).", "Cartes © contributeurs OpenStreetMap, OpenTopoMap, Esri. Noms d'espèces EN/FR : BirdNET (CC BY-NC-SA 4.0). Déclinaison : World Magnetic Model 2025 (NOAA/BGS). Géodésie selon Vincenty (WGS84)."],
};

const IDX = { de: 0, en: 1, fr: 2 };
let lang = "de";

export function detectLang(pref) {
  if (pref && pref !== "auto" && IDX[pref] !== undefined) return pref;
  for (const l of navigator.languages || [navigator.language || "de"]) {
    const k = String(l).slice(0, 2).toLowerCase();
    if (IDX[k] !== undefined) return k;
  }
  return "de";
}
export function setLang(l) {
  lang = IDX[l] !== undefined ? l : "de";
  document.documentElement.lang = lang;
  applyStatic();
}
export const getLang = () => lang;
export const locale = () => LOCALE[lang];

export function t(key, vars) {
  const row = S[key];
  let s = row ? row[IDX[lang]] ?? row[0] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}

/** Fill [data-i18n] text, [data-i18n-ph] placeholders, [data-i18n-aria] labels. */
export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
}

/** Display name of a species in the current language, with fallback. */
export function speciesName(s) {
  if (!s) return "";
  if (lang === "de") return s.de;
  return s[lang] || s.en || s.de;
}
/** True when the shown name is the German fallback in an English/French UI. */
export const isGermanFallback = (s) => lang !== "de" && !s[lang] && !s.en;

export const BREEDING_CODES = ["A1", "A2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "C10", "C11", "C12", "C13", "C14", "C15", "C16"];
