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
                    groups.groupID,
                    groups.name as groupName,
                    items.libraryID
                FROM
                    items
                    LEFT JOIN groups ON groups.libraryID = items.libraryID
            `;

export default {
    queryBbt,
    queryItems
};