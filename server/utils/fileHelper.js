// Helper function to convert file path to URL
export const getFileUrl = (req, filePath) => {
    if (!filePath) return '';
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/${filePath}`;
};