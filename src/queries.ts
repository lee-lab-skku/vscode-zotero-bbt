// src/queries.ts
// query for better bibtex citation keys
export const queryBbt = `
                SELECT
                    itemKey, citationKey
                FROM
                    citationkey
            `;

// query for zotero items
export const queryItems = `
                SELECT
                    DISTINCT items.key, items.itemID,
                    fields.fieldName,
                    parentItemDataValues.value,
                    itemTypes.typeName
                FROM
                    items
                    INNER JOIN itemData ON itemData.itemID = items.itemID
                    INNER JOIN itemDataValues ON itemData.valueID = itemDataValues.valueID
                    INNER JOIN itemData as parentItemData ON parentItemData.itemID = items.itemID
                    INNER JOIN itemDataValues as parentItemDataValues ON parentItemDataValues.valueID = parentItemData.valueID
                    INNER JOIN fields ON fields.fieldID = parentItemData.fieldID
                    INNER JOIN itemTypes ON itemTypes.itemTypeID = items.itemTypeID
                 WHERE
					itemTypes.typeName NOT LIKE "attachment" AND
					itemTypes.typeName NOT LIKE "annotation"
                `;

// query for creators
export const queryCreators = `
                SELECT
                    DISTINCT items.key,
                    creators.firstName,
                    creators.lastName,
                    itemCreators.orderIndex,
                    creatorTypes.creatorType
                FROM
                    items
                    INNER JOIN itemData ON itemData.itemID = items.itemID
                    INNER JOIN itemCreators ON itemCreators.itemID = items.itemID
                    INNER JOIN creators ON creators.creatorID = itemCreators.creatorID
                    INNER JOIN creatorTypes ON itemCreators.creatorTypeID = creatorTypes.creatorTypeID
            `;

export default {
    queryBbt,
    queryItems,
    queryCreators
};