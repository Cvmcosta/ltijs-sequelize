"use strict";

const Sequelize = require('sequelize');

const up = async ({
  context: queryInterface
}) => {
  await queryInterface.removeIndex('accesstokens', ['platformUrl', 'clientId', 'scopes']);
  await queryInterface.addColumn('accesstokens', 'access_token_hash', {
    type: Sequelize.STRING,
    allowNull: false
  });
  await queryInterface.addIndex('accesstokens', {
    fields: ['access_token_hash']
  });
};

const down = async ({
  context: queryInterface
}) => {
  await queryInterface.removeColumn('accesstokens', 'access_token_hash');
};

module.exports = {
  up,
  down
};