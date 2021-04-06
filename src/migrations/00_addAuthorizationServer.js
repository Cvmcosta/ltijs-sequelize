
const Sequelize = require('sequelize')

const up = async ({ context: queryInterface }) => {
  await queryInterface.addColumn(
    'platforms',
    'authorizationServer',
    {
      type: Sequelize.STRING,
      allowNull: true,
      default: null
    }
  )
}

const down = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn(
    'platforms',
    'authorizationServer'
  )
}

module.exports = { up, down }
