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

export function queryPdfByZoteroKey(zoteroKey: string): string {
    return `
                SELECT DISTINCT 
                    items.key as zoteroKey,
                    fields.fieldName,
                    parentItemDataValues.value,
                    attachment_items.key AS pdfKey
                FROM
                    items
                    INNER JOIN itemData ON itemData.itemID = items.itemID
                    INNER JOIN itemDataValues ON itemData.valueID = itemDataValues.valueID
                    INNER JOIN itemData as parentItemData ON parentItemData.itemID = items.itemID
                    INNER JOIN itemDataValues as parentItemDataValues ON parentItemDataValues.valueID = parentItemData.valueID
                    INNER JOIN fields ON fields.fieldID = parentItemData.fieldID
                    LEFT JOIN itemAttachments ON items.itemID = itemAttachments.parentItemID AND itemAttachments.contentType = 'application/pdf'
                    LEFT JOIN items attachment_items ON itemAttachments.itemID = attachment_items.itemID
				WHERE
				  zoteroKey = '${zoteroKey}' AND fieldName = 'title';
    `;
};

export function queryDoiByZoteroKey(zoteroKey: string): string {
    return `
                SELECT DISTINCT 
                    items.key as zoteroKey,
                    fields.fieldName,
                    parentItemDataValues.value
                FROM
                    items
                    INNER JOIN itemData ON itemData.itemID = items.itemID
                    INNER JOIN itemDataValues ON itemData.valueID = itemDataValues.valueID
                    INNER JOIN itemData as parentItemData ON parentItemData.itemID = items.itemID
                    INNER JOIN itemDataValues as parentItemDataValues ON parentItemDataValues.valueID = parentItemData.valueID
                    INNER JOIN fields ON fields.fieldID = parentItemData.fieldID
				WHERE
				    zoteroKey = '${zoteroKey}' AND fieldName = 'DOI';
    `;
};

export default {
    queryBbt,
    queryItems
};