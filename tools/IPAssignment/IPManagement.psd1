@{
    # Module metadata
    RootModule = 'IPManagement.psm1'
    ModuleVersion = '1.0.0'
    GUID = 'a1b2c3d4-e5f6-7890-1234-567890abcdef'
    Author = 'Network Engineering Team'
    CompanyName = 'Azure Local Framework'
    Copyright = '(c) 2025 Azure Local Framework. All rights reserved.'
    Description = 'Advanced IP subnet calculation and allocation utilities for network infrastructure planning'
    
    # Minimum PowerShell version
    PowerShellVersion = '5.1'
    
    # Functions to export
    FunctionsToExport = @('New-SubnetPlan', 'New-SubnetPlanByHosts', 'New-SubnetPlanFromConfig')
    
    # Cmdlets to export
    CmdletsToExport = @()
    
    # Variables to export
    VariablesToExport = @()
    
    # Aliases to export
    AliasesToExport = @()
    
    # Private data
    PrivateData = @{
        PSData = @{
            Tags = @('Network', 'IP', 'Subnet', 'Networking', 'Azure', 'Infrastructure', 'IPAM')
            LicenseUri = ''
            ProjectUri = ''
            IconUri = ''
            ReleaseNotes = 'Initial release of IP management and subnet planning functions'
        }
    }
}
