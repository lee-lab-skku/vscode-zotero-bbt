// src/queries.ts
// query for better bibtex citation keys
export const queryBbt = `
SELECT
    itemKey AS zoteroKey,
    citationKey AS citeKey
FROM
    citationkey
`;

// query for zotero items
export const queryItems = `
SELECT DISTINCT 
    items.key AS zoteroKey,
    items.libraryID,
    creators.firstName,
    creators.lastName,
    max(CASE WHEN fields.fieldName = 'title' THEN itemDataValues.value END) AS title,
    max(CASE WHEN fields.fieldName = 'date' THEN itemDataValues.value END) AS date
FROM
    items
    INNER JOIN itemCreators ON items.itemID = itemCreators.itemID
    INNER JOIN creators ON itemCreators.creatorID = creators.creatorID
    INNER JOIN itemData ON items.itemID = itemData.itemID
    INNER JOIN itemDataValues ON itemData.valueID = itemDataValues.valueID
    LEFT JOIN fields ON itemData.fieldID = fields.fieldID
WHERE
    itemCreators.orderIndex = 0
GROUP BY
    items.key
`;

export default {
    queryBbt,
    queryItems
};