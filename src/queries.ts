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
                    itemTypes.typeName,
                    itemAttachments.path AS attachment_path,
                    itemAttachments.contentType AS attachment_content_type,
                    itemAttachments.linkMode AS attachment_link_mode,
                    SUBSTR(itemAttachments.path, INSTR(itemAttachments.path, ':') + 1) AS folder_name
                FROM
                    items
                    INNER JOIN itemData ON itemData.itemID = items.itemID
                    INNER JOIN itemDataValues ON itemData.valueID = itemDataValues.valueID
                    INNER JOIN itemData as parentItemData ON parentItemData.itemID = items.itemID
                    INNER JOIN itemDataValues as parentItemDataValues ON parentItemDataValues.valueID = parentItemData.valueID
                    INNER JOIN fields ON fields.fieldID = parentItemData.fieldID
                    INNER JOIN itemTypes ON itemTypes.itemTypeID = items.itemTypeID
                    LEFT JOIN itemAttachments ON items.itemID = itemAttachments.parentItemID AND itemAttachments.contentType = 'application/pdf'
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