// src/queries.ts

// query for zotero items (with creators aggregated as JSON)
export const queryItems = `
            WITH pivoted AS (
                SELECT
                    id.itemID,
                    MAX(CASE WHEN f.fieldName = 'title'       THEN idv.value END) AS title,
                    MAX(CASE WHEN f.fieldName = 'date'        THEN idv.value END) AS date,
                    MAX(CASE WHEN f.fieldName = 'citationKey' THEN idv.value END) AS citeKey
                FROM itemData id
                JOIN itemDataValues idv USING (valueID)
                JOIN fields f ON f.fieldID = id.fieldID
                WHERE f.fieldName IN ('title', 'date', 'citationKey')
                GROUP BY id.itemID
                HAVING citeKey IS NOT NULL
            )
            SELECT
                it.key AS zoteroKey, itypes.typeName AS itemType, it.libraryID,
                p.title, p.date, p.citeKey,
                json_group_array(json_object(
                    'firstName',   c.firstName,
                    'lastName',    c.lastName,
                    'creatorType', ct.creatorType,
                    'orderIndex',  ic.orderIndex
                )) AS creators
            FROM items it
            JOIN itemTypes itypes ON itypes.itemTypeID = it.itemTypeID
            JOIN pivoted p        ON p.itemID = it.itemID
            LEFT JOIN itemCreators ic ON ic.itemID = it.itemID
            LEFT JOIN creators c      ON c.creatorID = ic.creatorID
            LEFT JOIN creatorTypes ct ON ct.creatorTypeID = ic.creatorTypeID
            GROUP BY it.key, itypes.typeName, it.libraryID, p.title, p.date, p.citeKey;
            `;

// query for getting zotero item by citekey
export function queryZoteroKey(citeKey: string): string {
    return `
                SELECT DISTINCT 
                    items.key as zoteroKey,
                    parentItemDataValues.value as citeKey,
                    items.libraryID
                FROM
                    items
                    INNER JOIN itemData ON itemData.itemID = items.itemID
                    INNER JOIN itemDataValues ON itemData.valueID = itemDataValues.valueID
                    INNER JOIN itemData as parentItemData ON parentItemData.itemID = items.itemID
                    INNER JOIN itemDataValues as parentItemDataValues ON parentItemDataValues.valueID = parentItemData.valueID
                    INNER JOIN fields ON fields.fieldID = parentItemData.fieldID
				WHERE
					fields.fieldName == ('citationKey') AND citeKey = '${citeKey}';
            `;
};

// below queries are for opening zotero item/pdf by zotero key
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