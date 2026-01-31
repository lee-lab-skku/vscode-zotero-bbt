// src/queries.ts
// query for better bibtex citation keys
export const queryBbt = `
                SELECT
                    itemKey as zoteroKey, 
					citationKey as citeKey
                FROM
                    citationkey
            `;

// query for zotero items
export const queryItems = `
                SELECT DISTINCT 
                    items.key as zoteroKey,
                    fields.fieldName,
                    parentItemDataValues.value,
                    itemTypes.typeName,
                    items.libraryID
                FROM
                    items
                    INNER JOIN itemData ON itemData.itemID = items.itemID
                    INNER JOIN itemDataValues ON itemData.valueID = itemDataValues.valueID
                    INNER JOIN itemData as parentItemData ON parentItemData.itemID = items.itemID
                    INNER JOIN itemDataValues as parentItemDataValues ON parentItemDataValues.valueID = parentItemData.valueID
                    INNER JOIN fields ON fields.fieldID = parentItemData.fieldID
                    INNER JOIN itemTypes ON itemTypes.itemTypeID = items.itemTypeID
				WHERE
					fields.fieldName IN ('title', 'date');
            `;

// query for creators
export const queryCreators = `
                SELECT DISTINCT
                    items.key as zoteroKey,
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

export function queryPdfByZoteroKey(zoteroKey: string, libraryID: number): string {
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
                    zoteroKey = '${zoteroKey}' AND 
                    items.libraryID = ${libraryID} AND 
                    fieldName = 'title';
    `;
};

export function queryDoiByZoteroKey(zoteroKey: string, libraryID: number): string {
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
                    zoteroKey = '${zoteroKey}' AND 
                    items.libraryID = ${libraryID} AND 
                    fieldName = 'DOI';
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
    queryItems,
    queryCreators
};