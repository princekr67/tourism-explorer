
import pkg from './package.json' with { type: 'json' };

export default {
  name: pkg.name,

  triggers: {
    keywords: [
      'tourist attractions',
      'things to do',
      'places to visit',
      'landmarks',
      'sights',
      'points of interest',
      'museums',
      'monuments',
      'temples',
      'forts',
      'viewpoints',
      'parks',
      'historical sites',
      'buildings'
    ]
  },

  query_format: {
    regex: [
      '((best|top|famous)\\s+)?(tourist\\s+attractions?|things\\s+to\\s+do|places\\s+to\\s+(visit|see)|landmarks|sights|points\\s+of\\s+interest)\\s+(?:(in|near|around)\\s+)?HD_LOCATION(__\\w+)?.*',

      '((best|top|famous)\\s+)?(museums?|monuments?|temples?|forts?|viewpoints?|parks?|historic(al)?\\s+sites?)\\s+(?:(in|near|around)\\s+)?HD_LOCATION(__\\w+)?.*',

      'buildings\\s+(?:(in|near|around)\\s+)?HD_LOCATION(__\\w+)?.*'
    ]
  },

  client: {
    location: pkg.module,
    moduleName: pkg.umdName || 'HD' + pkg.name,
    baseURL: '/' + pkg.name
  },

  format: {
    mainline: true,
    sidebar: true
  },

  permissions: {},

  info: {},

  github: '',
  demovideo: ''
};
