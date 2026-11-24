/* Auswahllisten und Zahlenwerte. Hier ändern, wenn Optionen angepasst werden sollen. */
window.DATA = (() => {
  const DETAILS = {
    'Softwareentwicklung': ['Webanwendungen', 'Mobile Apps', 'Individualsoftware', 'Schnittstellen und Integration', 'Fachverfahren', 'Barrierefreiheit', 'Datenbanken und Auswertung', 'KI und Automatisierung'],
    'Hosting und Betrieb': ['Cloud-Migration', 'Managed Hosting', 'Rechenzentrumsbetrieb', 'Backup und Notfallwiederherstellung', 'Monitoring', 'Betrieb von Fachverfahren'],
    'IT-Beratung': ['IT-Strategie', 'Digitalisierung und OZG', 'Projektmanagement', 'Prozessberatung', 'Architektur', 'Schulung'],
    'Support und Service': ['Service Desk', 'Vor-Ort-Support', 'Wartung und Pflege', 'Rollout und Migration', 'Anwendersupport'],
    'IT-Sicherheit': ['Penetrationstests', 'Informationssicherheit (ISMS)', 'Security Monitoring', 'Awareness-Schulungen', 'Notfallübungen'],
    'Hardware und Infrastruktur': ['Arbeitsplatzgeräte', 'Netzwerk und WLAN', 'Server und Speicher', 'Telefonie und Kommunikation', 'Drucker und Peripherie']
  };
  const SIZES = [0, 1000, 2500, 5000, 10000, 25000, 50000, 100000];   // letzter Wert = „und mehr“
  const KM = [10, 25, 50, 100, 200, 0];          // 0 = ganz DACH
  const CITIES = {
    'Deutschland': [['Augsburg',10.90,48.37],['Berlin',13.40,52.52],['Bielefeld',8.53,52.02],['Bochum',7.22,51.48],['Bonn',7.10,50.73],['Braunschweig',10.52,52.27],['Bremen',8.80,53.08],['Chemnitz',12.92,50.83],['Dortmund',7.47,51.51],['Dresden',13.74,51.05],['Duisburg',6.76,51.43],['Düsseldorf',6.77,51.23],['Erfurt',11.03,50.98],['Essen',7.01,51.46],['Frankfurt am Main',8.68,50.11],['Freiburg',7.85,47.99],['Göttingen',9.93,51.53],['Halle (Saale)',11.97,51.48],['Hamburg',9.99,53.55],['Hannover',9.73,52.37],['Heidelberg',8.69,49.40],['Kassel',9.49,51.31],['Kiel',10.14,54.32],['Koblenz',7.59,50.36],['Köln',6.96,50.94],['Leipzig',12.37,51.34],['Lübeck',10.69,53.87],['Magdeburg',11.63,52.13],['Mainz',8.27,50.00],['Mannheim',8.47,49.49],['München',11.58,48.14],['Münster',7.63,51.96],['Nürnberg',11.08,49.45],['Oldenburg',8.21,53.14],['Osnabrück',8.05,52.28],['Potsdam',13.06,52.40],['Regensburg',12.10,49.01],['Rostock',12.14,54.09],['Saarbrücken',7.00,49.24],['Schwerin',11.41,53.63],['Stuttgart',9.18,48.78],['Trier',6.64,49.76],['Ulm',9.99,48.40],['Wiesbaden',8.24,50.08],['Wuppertal',7.15,51.26],['Würzburg',9.93,49.79]],
    'Österreich': [['Bregenz',9.75,47.50],['Eisenstadt',16.52,47.85],['Graz',15.44,47.07],['Innsbruck',11.39,47.26],['Klagenfurt',14.31,46.62],['Linz',14.29,48.31],['Salzburg',13.04,47.80],['St. Pölten',15.63,48.20],['Villach',13.85,46.61],['Wien',16.37,48.21]],
    'Schweiz': [['Basel',7.59,47.56],['Bern',7.45,46.95],['Biel',7.25,47.14],['Chur',9.53,46.85],['Genf',6.14,46.20],['Lausanne',6.63,46.52],['Lugano',8.95,46.00],['Luzern',8.31,47.05],['Sitten',7.36,46.23],['St. Gallen',9.38,47.42],['Winterthur',8.72,47.50],['Zürich',8.54,47.38]]
  };
  return { DETAILS, SIZES, KM, CITIES };
})();
