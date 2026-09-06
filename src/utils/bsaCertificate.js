const formatSection63Certificate = (caseData, documentData, officerData, telemetryData) => ({
  certificateHeader: 'BHARATIYA SAKSHYA ADHINIYAM, 2023 - SECTION 63(4) COMPLIANCE',
  caseReference: {
    caseId: caseData?.id ?? 'N/A',
    caseNumber: caseData?.caseNumber ?? 'N/A',
  },
  partA_DeviceTelemetry: {
    sourceIp: telemetryData?.ip ?? 'N/A',
    userAgent: telemetryData?.userAgent ?? 'N/A',
    terminalId: telemetryData?.mockTerminalId ?? 'N/A',
    timestamp: new Date().toISOString(),
  },
  partB_DigitalForensics: {
    documentId: documentData?.id ?? 'N/A',
    originalFileName: documentData?.originalFileName ?? documentData?.originalFilePath ?? 'N/A',
    sha256Hash: documentData?.fileHash ?? 'N/A',
    encryptionStatus: 'AES-256',
  },
  certifyingOfficer: {
    officerId: officerData?.id ?? 'N/A',
    name: officerData?.name ?? officerData?.email ?? 'N/A',
    role: officerData?.role ?? 'N/A',
    legalStatement: 'I certify that this electronic record was produced by a computer resource in my lawful control, operating properly at the time of evidence ingestion.',
  },
});

export default formatSection63Certificate;
export { formatSection63Certificate };
