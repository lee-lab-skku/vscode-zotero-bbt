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
    max(CASE WHEN fields.fieldName = 'date' THEN itemDataValues.value END) AS date,
    max(itemCreators.orderIndex) AS multiAuthor
FROM
    items
    INNER JOIN itemCreators ON items.itemID = itemCreators.itemID
    INNER JOIN creators ON itemCreators.creatorID = creators.creatorID
    INNER JOIN itemData ON items.itemID = itemData.itemID
    INNER JOIN itemDataValues ON itemData.valueID = itemDataValues.valueID
    LEFT JOIN fields ON itemData.fieldID = fields.fieldID
WHERE
    itemCreators.orderIndex IN (0, 1)
GROUP BY
    items.key
`;

export function queryZoteroKey(citeKey: string): string {
    return `
SELECT
    itemKey as zoteroKey,
    citationKey as citeKey,
    libraryID
FROM
    citationkey
WHERE
    citeKey = '${citeKey}';
    `;
};

export function queryGroupIDByLibraryID(libraryID: number): string {
    return `
SELECT
    groupID,
    libraryID,
    name
FROM
    groups
WHERE
    libraryID = ${libraryID};
    `;
};

export function queryGroupItemsByZoterokey(zoteroKey: string, libraryID: number): string {
    return `
SELECT DISTINCT 
    items.key as zoteroKey,
    parentItemDataValues.value as title,
    itemTypes.typeName,
    items.libraryID,
    groups.name as libraryName
FROM
    items
    INNER JOIN itemData ON itemData.itemID = items.itemID
    INNER JOIN itemDataValues ON itemData.valueID = itemDataValues.valueID
    INNER JOIN itemData as parentItemData ON parentItemData.itemID = items.itemID
    INNER JOIN itemDataValues as parentItemDataValues ON parentItemDataValues.valueID = parentItemData.valueID
    INNER JOIN itemTypes ON itemTypes.itemTypeID = items.itemTypeID
    LEFT JOIN groups ON items.libraryID = groups.libraryID
WHERE
    parentItemData.fieldID = 1 AND  items.key = '${zoteroKey}' AND items.libraryID = ${libraryID};
    `;
}

export default {
    queryBbt,
    queryItems
};
