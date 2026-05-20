const sanctionsConfig = {
  'propos_deplaces': {
    label: 'Propos déplacés',
    durations: [
      { label: '10m (propos provoquants/moqueurs)', value: '10m', duration: 600000 },
      { label: '15m (propos dérangeants)', value: '15m', duration: 900000 },
      { label: '20m (propos sexuel, misogyne)', value: '20m', duration: 1200000 }
    ]
  },
  'insultes': {
    label: 'Insultes',
    durations: [
      { label: '15m (insulte légère)', value: '15m', duration: 900000 },
      { label: '30m (insultes répétées)', value: '30m', duration: 1800000 },
    ]
  },
  'spam': {
    label: 'Spam',
    durations: [
      { label: '10m (spam léger)', value: '10m', duration: 600000 },
      { label: '20m (spam répété)', value: '20m', duration: 1200000 },
      { label: '1h (spam excessif)', value: '1h', duration: 3600000 }
    ]
  },
  'troll': {
    label: 'Troll',
    durations: [
      { label: '10m (troll léger)', value: '10m', duration: 600000 },
      { label: '15m (troll intensif)', value: '15m', duration: 900000 },
    ]
  },
  'soundboard': {
    label: 'Soundboard',
    durations: [
      { label: '20m (config dérangeante)', value: '20m', duration: 1200000 },
      { label: '30m (config très dérangeante)', value: '30m', duration: 1800000 },
      { label: '40m (soundboard abusif)', value: '40m', duration: 2400000 }
    ]
  },
  'discrimination': {
    label: 'Discrimination',
    durations: [
      { label: '30m (racisme, islamophobie, homophobie...)', value: '30m', duration: 1800000 },
    ]
  },
  'double_compte': {
    label: 'Double compte',
    durations: [
      { label: '20m (double compte vérifié)', value: '20m', duration: 1200000 },
      { label: '30m (abus de double compte)', value: '30m', duration: 1800000 }
    ]
  },
  'pub': {
    label: 'Publicité',
    durations: [
      { label: '35m (publicité)', value: '35m', duration: 2100000 },
      { label: '1h (pub répétée)', value: '1h', duration: 3600000 },
      { label: '2h (spam pub)', value: '2h', duration: 7200000 }
    ]
  }
};

module.exports = { sanctionsConfig };
