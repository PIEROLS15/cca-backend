const makeImpactItem = ({ label, count, note = null }) => ({
  label,
  count,
  note,
});

const makeDeletionPreview = ({
  entityLabel,
  itemName,
  willDelete = [],
  willSetNull = [],
  willBlock = [],
}) => ({
  entityLabel,
  itemName,
  canDelete: willBlock.length === 0,
  willDelete,
  willSetNull,
  willBlock,
});

module.exports = {
  makeImpactItem,
  makeDeletionPreview,
};
