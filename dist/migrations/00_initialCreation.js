"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

const Sequelize = require('sequelize');

const tables = [];

const up = async ({
  context: queryInterface,
  dialect
}) => {
  // state
  tables.push({
    tableName: 'states',
    fields: {
      state: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      query: {
        type: Sequelize.JSON
      }
    },
    indexes: [{
      fields: [{
        attribute: 'state',
        length: 50
      }],
      unique: true
    }, {
      fields: ['createdAt']
    }]
  }); // nonce

  tables.push({
    tableName: 'nonces',
    fields: {
      nonce: {
        type: Sequelize.STRING,
        primaryKey: true
      }
    },
    indexes: [{
      fields: [{
        attribute: 'nonce',
        length: 50
      }],
      unique: true
    }, {
      fields: ['createdAt']
    }]
  }); // accesstoken

  tables.push({
    tableName: 'accesstokens',
    fields: {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      platformUrl: {
        type: Sequelize.TEXT
      },
      clientId: {
        type: Sequelize.TEXT
      },
      scopes: {
        type: Sequelize.TEXT
      },
      iv: {
        type: Sequelize.TEXT
      },
      data: {
        type: Sequelize.TEXT
      }
    },
    indexes: [{
      fields: [{
        attribute: 'platformUrl',
        length: 50
      }, {
        attribute: 'clientId',
        length: 50
      }, {
        attribute: 'scopes',
        length: 50
      }],
      unique: true
    }, {
      fields: ['createdAt']
    }]
  }); // privatekey

  tables.push({
    tableName: 'privatekeys',
    fields: {
      kid: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      platformUrl: {
        type: Sequelize.TEXT
      },
      clientId: {
        type: Sequelize.TEXT
      },
      iv: {
        type: Sequelize.TEXT
      },
      data: {
        type: Sequelize.TEXT
      }
    },
    indexes: [{
      fields: [{
        attribute: 'kid',
        length: 50
      }],
      unique: true
    }]
  }); // publickey

  tables.push({
    tableName: 'publickeys',
    fields: {
      kid: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      platformUrl: {
        type: Sequelize.TEXT
      },
      clientId: {
        type: Sequelize.TEXT
      },
      iv: {
        type: Sequelize.TEXT
      },
      data: {
        type: Sequelize.TEXT
      }
    },
    indexes: [{
      fields: [{
        attribute: 'kid',
        length: 50
      }],
      unique: true
    }]
  }); // platformStatus

  tables.push({
    tableName: 'platformStatuses',
    fields: {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }
    },
    indexes: [{
      fields: ['id'],
      unique: true
    }]
  }); // platform

  tables.push({
    tableName: 'platforms',
    fields: {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      platformName: {
        type: Sequelize.TEXT
      },
      platformUrl: {
        type: Sequelize.TEXT
      },
      clientId: {
        type: Sequelize.TEXT
      },
      authEndpoint: {
        type: Sequelize.TEXT
      },
      accesstokenEndpoint: {
        type: Sequelize.TEXT
      },
      kid: {
        type: Sequelize.TEXT
      },
      authConfig: {
        type: Sequelize.JSON
      }
    },
    indexes: [{
      fields: [{
        attribute: 'platformUrl',
        length: 50
      }, {
        attribute: 'clientId',
        length: 50
      }],
      unique: true
    }, {
      fields: [{
        attribute: 'platformUrl',
        length: 50
      }]
    }, {
      fields: [{
        attribute: 'kid',
        length: 50
      }],
      unique: true
    }]
  }); // contexttoken

  tables.push({
    tableName: 'contexttokens',
    fields: {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      contextId: {
        type: Sequelize.TEXT
      },
      path: {
        type: Sequelize.TEXT
      },
      user: {
        type: Sequelize.TEXT
      },
      roles: {
        type: dialect === 'postgres' ? {
          type: Sequelize.ARRAY(Sequelize.TEXT)
        } : Sequelize.TEXT
      },
      targetLinkUri: {
        type: Sequelize.TEXT
      },
      context: {
        type: Sequelize.JSON
      },
      resource: {
        type: Sequelize.JSON
      },
      custom: {
        type: Sequelize.JSON
      },
      endpoint: {
        type: Sequelize.JSON
      },
      namesRoles: {
        type: Sequelize.JSON
      },
      lis: {
        type: Sequelize.JSON
      },
      launchPresentation: {
        type: Sequelize.JSON
      },
      messageType: {
        type: Sequelize.TEXT
      },
      version: {
        type: Sequelize.TEXT
      },
      deepLinkingSettings: {
        type: Sequelize.JSON
      }
    },
    indexes: [{
      fields: [{
        attribute: 'contextId',
        length: 50
      }, {
        attribute: 'user',
        length: 50
      }]
    }, {
      fields: ['createdAt']
    }]
  }); // idtoken

  tables.push({
    tableName: 'idtokens',
    fields: {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      iss: {
        type: Sequelize.TEXT
      },
      platformId: {
        type: Sequelize.TEXT
      },
      clientId: {
        type: Sequelize.TEXT
      },
      deploymentId: {
        type: Sequelize.TEXT
      },
      user: {
        type: Sequelize.TEXT
      },
      userInfo: {
        type: Sequelize.JSON
      },
      platformInfo: {
        type: Sequelize.JSON
      }
    },
    indexes: [{
      fields: [{
        attribute: 'iss',
        length: 50
      }, {
        attribute: 'clientId',
        length: 50
      }, {
        attribute: 'deploymentId',
        length: 50
      }, {
        attribute: 'user',
        length: 50
      }]
    }, {
      fields: ['createdAt']
    }]
  }); // Loop through and make/build the tables.

  const timeDefaults = {
    createdAt: {
      type: Sequelize.DATE,
      field: 'createdAt'
    },
    updatedAt: {
      type: Sequelize.DATE,
      field: 'updatedAt'
    }
  };
  tables.forEach(async tableConfig => {
    await queryInterface.createTable(tableConfig.tableName, _objectSpread(_objectSpread({}, tableConfig.fields), timeDefaults));
    tableConfig.indexes.forEach(async indexConfig => {
      await queryInterface.addIndex(tableConfig.tableName, indexConfig);
    });
  });
};

const down = async ({
  context: queryInterface
}) => {};

module.exports = {
  up,
  down
};