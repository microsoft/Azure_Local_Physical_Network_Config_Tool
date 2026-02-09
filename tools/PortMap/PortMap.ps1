#Requires -Version 5.1

<#
.SYNOPSIS
    PortMap Tool - Network Device Physical Port Assignment Documentation Generator

.DESCRIPTION
    The PortMap tool is a network documentation utility designed to detail physical port assignments 
    and cable connections for network devices. It creates comprehensive documentation artifacts that 
    describe the physical cabling configuration of network switches.

.PARAMETER InputFile
    Path to the input JSON configuration file describing network devices and connections (mutually exclusive with DeviceCsvFile/ConnectionCsvFile parameter set).

.PARAMETER DeviceCsvFile
    Path to the devices CSV file (one row per port range). Required in CSV parameter set.

.PARAMETER ConnectionCsvFile
    Optional path to the connections CSV file (one row per connection definition). If omitted, only device/port inventory is processed.

.PARAMETER OutputFormat
    Output format for the port mapping data. Valid values: Markdown, CSV, JSON

.PARAMETER OutputFile
    Optional output file path. If not specified, Markdown output goes to console.

.PARAMETER ShowUnused
    Include unused ports in the output analysis.

.PARAMETER DeviceFilter
    Filter output by specific device names (comma-separated list).

.PARAMETER Validate
    Validate the input JSON configuration without generating output.

 .EXAMPLE
    JSON Input (original):
        .\PortMap.ps1 -InputFile "network-config.json" -OutputFormat Markdown

.EXAMPLE
    CSV Input (devices + connections):
        .\PortMap.ps1 -DeviceCsvFile .\devices.csv -ConnectionCsvFile .\connections.csv -OutputFormat Markdown

.EXAMPLE
    CSV Input (devices only inventory):
        .\PortMap.ps1 -DeviceCsvFile .\devices.csv -OutputFormat JSON -Validate

.EXAMPLE
    .\PortMap.ps1 -InputFile "datacenter-design.json" -OutputFormat CSV -OutputFile "port-mapping.csv"

.EXAMPLE
    .\PortMap.ps1 -InputFile "rack-layout.json" -OutputFormat JSON -OutputFile "port-data.json" -ShowUnused

.NOTES
    Version: 1.0
    Author: Network Engineering Team
    Purpose: Part of Azure Local Network Switch Config Generator project
<#
 Added CSV input support (DeviceCsvFile/ConnectionCsvFile) with new parameter sets:
    - JsonProcess / JsonValidate = legacy JSON input path
    - CsvProcess  / CsvValidate  = CSV input mode

<#
 Added CSV input support (DeviceCsvFile/ConnectionCsvFile) with new parameter sets:
    - JsonProcess / JsonValidate = legacy JSON input path
    - CsvProcess  / CsvValidate  = CSV input mode
#>
[CmdletBinding(DefaultParameterSetName = 'JsonProcess')]
param(
    # JSON Input (original behavior)
    [Parameter(
        Mandatory = $true,
        Position = 0,
        ParameterSetName = 'JsonProcess',
        HelpMessage = "Path to the input JSON configuration file describing network devices and connections"
    )]
    [Parameter(
        Mandatory = $true,
        Position = 0,
        ParameterSetName = 'JsonValidate',
        HelpMessage = "Path to the input JSON configuration file describing network devices and connections"
    )]
    [ValidateScript({
            if ($_ -and -not (Test-Path -Path $_ -PathType Leaf)) {
                throw "File does not exist: $_"
            }
            if ($_ -and -not ($_ -match '\.json$')) {
                throw "File must have .json extension: $_"
            }
            return $true
        })]
    [Alias('Config', 'Input')]
    [string]$InputFile,

    # CSV Inputs (new) - devices CSV required, connections CSV optional
    [Parameter(
        Mandatory = $true,
        ParameterSetName = 'CsvProcess',
        HelpMessage = "Path to devices CSV file (one row per port range)"
    )]
    [Parameter(
        Mandatory = $true,
        ParameterSetName = 'CsvValidate',
        HelpMessage = "Path to devices CSV file (one row per port range)"
    )]
    [ValidateScript({
            if ($_ -and -not (Test-Path -Path $_ -PathType Leaf)) { throw "Devices CSV file does not exist: $_" }
            if ($_ -and -not ($_ -match '\.csv$')) { throw "Devices CSV must have .csv extension: $_" }
            return $true
        })]
    [string]$DeviceCsvFile,

    [Parameter(
        Mandatory = $false,
        ParameterSetName = 'CsvProcess',
        HelpMessage = "Optional connections CSV file"
    )]
    [Parameter(
        Mandatory = $false,
        ParameterSetName = 'CsvValidate',
        HelpMessage = "Optional connections CSV file"
    )]
    [Parameter(
        Mandatory = $false,
        ParameterSetName = 'CsvValidate',
        HelpMessage = "Optional connections CSV file"
    )]
    [ValidateScript({
            if ($_ -and -not (Test-Path -Path $_ -PathType Leaf)) { throw "Connections CSV file does not exist: $_" }
            if ($_ -and -not ($_ -match '\.csv$')) { throw "Connections CSV must have .csv extension: $_" }
            return $true
        })]
    [string]$ConnectionCsvFile,

    # Output format (all parameter sets)
    [Parameter(Mandatory = $true, ParameterSetName = 'JsonProcess', HelpMessage = "Output format for the port mapping data")]
    [Parameter(Mandatory = $true, ParameterSetName = 'CsvProcess', HelpMessage = "Output format for the port mapping data")]
    [Parameter(Mandatory = $true, ParameterSetName = 'JsonValidate')]
    [Parameter(Mandatory = $true, ParameterSetName = 'CsvValidate')]
    [ValidateSet("Markdown", "CSV", "JSON", IgnoreCase = $true)]
    [Alias('Format')]
    [string]$OutputFormat,

    [Parameter(Mandatory = $false, ParameterSetName='JsonProcess')]
    [Parameter(Mandatory = $false, ParameterSetName='CsvProcess')]
    [Parameter(Mandatory = $false, ParameterSetName='JsonValidate')]
    [Parameter(Mandatory = $false, ParameterSetName='CsvValidate')]
    [ValidateScript({
            if ($_ -and -not (Test-Path -Path $_ -PathType Leaf)) { throw "Connections CSV file does not exist: $_" }
            if ($_ -and -not ($_ -match '\.csv$')) { throw "Connections CSV must have .csv extension: $_" }
            return $true
        })]
    [string]$ConnectionCsvFile,

    # Output format (all parameter sets)
    [Parameter(Mandatory = $true, ParameterSetName = 'JsonProcess', HelpMessage = "Output format for the port mapping data")]
    [Parameter(Mandatory = $true, ParameterSetName = 'CsvProcess', HelpMessage = "Output format for the port mapping data")]
    [Parameter(Mandatory = $true, ParameterSetName = 'JsonValidate')]
    [Parameter(Mandatory = $true, ParameterSetName = 'CsvValidate')]
    [ValidateSet("Markdown", "CSV", "JSON", IgnoreCase = $true)]
    [Alias('Format')]
    [string]$OutputFormat,

    [Parameter(Mandatory = $false, ParameterSetName='JsonProcess')]
    [Parameter(Mandatory = $false, ParameterSetName='CsvProcess')]
    [Parameter(Mandatory = $false, ParameterSetName='JsonValidate')]
    [Parameter(Mandatory = $false, ParameterSetName='CsvValidate')]
    [ValidateScript({
            if (-not $_) { return $true }
            $directory = Split-Path -Path $_ -Parent
            if ($directory -and -not (Test-Path -Path $directory)) {
                throw "Output directory does not exist: $directory"
            }
            return $true
        })]
    [Alias('Output', 'File')]
    [string]$OutputFile,

    [Parameter(Mandatory = $false, ParameterSetName='JsonProcess')]
    [Parameter(Mandatory = $false, ParameterSetName='CsvProcess')]
    [Alias('Unused')]
    [switch]$ShowUnused = $false,

    [Parameter(Mandatory = $false, ParameterSetName='JsonProcess')]
    [Parameter(Mandatory = $false, ParameterSetName='CsvProcess')]
    [ValidateNotNullOrEmpty()]
    [Alias('Filter', 'Devices')]
    [string[]]$DeviceFilter,

    # Validation switch (applies to both JSON and CSV parameter sets)
    [Parameter(
        Mandatory = $false,
        ParameterSetName = 'JsonValidate',
        HelpMessage = "Validate the input configuration without generating output"
    )]
    [Parameter(
        Mandatory = $false,
        ParameterSetName = 'CsvValidate',
        HelpMessage = "Validate the input configuration without generating output"
    )]
    [switch]$Validate,

    [Parameter(
        Mandatory = $false,
        HelpMessage = "Display detailed progress information"
    )]
    [switch]$Detailed
)

# Script-level variables - Using proper scoping
$Script:ErrorCount = 0
$Script:ValidationErrors = [System.Collections.Generic.List[string]]::new()
$Script:PortMapVersion = "1.0.0"

# Set strict mode for better error handling
Set-StrictMode -Version Latest

# Initialize error action preference
$ErrorActionPreference = 'Stop'

#region Helper Functions

function Write-PortMapLog {
    <#
    .SYNOPSIS
        Writes formatted log messages for the PortMap tool.
    
    .DESCRIPTION
        Provides consistent logging with timestamps and color coding based on message level.
    
    .PARAMETER Message
        The message to log.
    
    .PARAMETER Level
        The logging level (Info, Warning, Error).
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        
        [Parameter(Mandatory = $false)]
        [ValidateSet("Info", "Warning", "Error")]
        [string]$Level = "Info"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    switch ($Level) {
        "Info" { 
            Write-Host $logMessage -ForegroundColor Green 
        }
        "Warning" { 
            Write-Warning $logMessage 
        }
        "Error" { 
            Write-Error $logMessage
            $Script:ErrorCount++
        }
    }
}

function Import-PortMapCsvConfiguration {
    <#
    .SYNOPSIS
        Builds the canonical configuration object from CSV input files.
    .DESCRIPTION
        Converts two CSV files (devices & connections) into the same structure expected
        by JSON parsing logic: @{ devices = @(); connections = @() }
        Devices CSV Schema (one row per port range):
            DeviceName,DeviceMake,DeviceModel,Location,Rack,RackUnit,PortRange,MediaType,Speed,Description
        Connections CSV Schema (one row per connection mapping block):
            SourceDevice,SourcePorts,SourceMedia,DestinationDevice,DestinationPorts,DestinationMedia,ConnectionType,Notes
        Notes:
            - Rack / RackUnit are optional (alternative to Location)
            - DestinationPorts optional (0 placeholder if missing)
            - Speed / Description optional on connections
    .PARAMETER DeviceCsvFile
        Path to device CSV file.
    .PARAMETER ConnectionCsvFile
        Optional path to connections CSV file.
    .OUTPUTS
        PSCustomObject with .devices and .connections collections.
    #>
    [CmdletBinding()] 
    param(
        [Parameter(Mandatory = $true)]
        [string]$DeviceCsvFile,
        [Parameter(Mandatory = $false)]
        [string]$ConnectionCsvFile
    )

    Write-PortMapLog "Parsing devices CSV: $DeviceCsvFile" -Level Info
    $deviceRows = Import-Csv -Path $DeviceCsvFile

    if (-not $deviceRows -or $deviceRows.Count -eq 0) {
        throw "Devices CSV is empty: $DeviceCsvFile"
    }

    # Group rows by device to aggregate port ranges
    $deviceGroups = $deviceRows | Group-Object -Property DeviceName
    $devices = [System.Collections.Generic.List[object]]::new()

    foreach ($group in $deviceGroups) {
        $first = $group.Group | Select-Object -First 1
        $portRanges = [System.Collections.Generic.List[object]]::new()
        foreach ($row in $group.Group) {
            if (-not $row.PortRange) { continue }
            $portRanges.Add([PSCustomObject]@{ range = $row.PortRange; mediaType = $row.MediaType; speed = $row.Speed; description = $row.Description })
        }

        if ($portRanges.Count -eq 0) { Write-PortMapLog "Device '$($group.Name)' has no valid PortRange entries" -Level Warning }

        $deviceObj = [PSCustomObject]@{
            deviceName = $group.Name
            deviceMake = $first.DeviceMake
            deviceModel = $first.DeviceModel
            location = if ($first.Location) { $first.Location } else { $null }
            rack = if ($first.Rack) { $first.Rack } else { $null }
            rackUnit = if ($first.RackUnit) { $first.RackUnit } else { $null }
            portRanges = $portRanges
        }
        $devices.Add($deviceObj)
    }

    $connections = @()
    if ($ConnectionCsvFile) {
        if (Test-Path -Path $ConnectionCsvFile -PathType Leaf) {
            Write-PortMapLog "Parsing connections CSV: $ConnectionCsvFile" -Level Info
            $connectionRows = Import-Csv -Path $ConnectionCsvFile
            $connList = [System.Collections.Generic.List[object]]::new()
            foreach ($row in $connectionRows) {
                if (-not $row.SourceDevice -or -not $row.SourcePorts) { 
                    Write-PortMapLog "Skipping connection row missing SourceDevice or SourcePorts" -Level Warning
                    continue 
                }
                $connList.Add([PSCustomObject]@{
                        sourceDevice = $row.SourceDevice
                        sourcePorts = $row.SourcePorts
                        sourceMedia = $row.SourceMedia
                        destinationDevice = $row.DestinationDevice
                        destinationPorts = if ($row.DestinationPorts) { $row.DestinationPorts } else { '0' }
                        destinationMedia = $row.DestinationMedia
                        connectionType = $row.ConnectionType
                        notes = $row.Notes
                    })
            }
            $connections = $connList.ToArray()
        }
        else {
            Write-PortMapLog "Connections CSV file not found: $ConnectionCsvFile" -Level Warning
        }
    }

    return [PSCustomObject]@{ devices = $devices.ToArray(); connections = $connections }
}

function Import-PortMapCsvConfiguration {
    <#
    .SYNOPSIS
        Builds the canonical configuration object from CSV input files.
    .DESCRIPTION
        Converts two CSV files (devices & connections) into the same structure expected
        by JSON parsing logic: @{ devices = @(); connections = @() }
        Devices CSV Schema (one row per port range):
            DeviceName,DeviceMake,DeviceModel,Location,Rack,RackUnit,PortRange,MediaType,Speed,Description
        Connections CSV Schema (one row per connection mapping block):
            SourceDevice,SourcePorts,SourceMedia,DestinationDevice,DestinationPorts,DestinationMedia,ConnectionType,Notes
        Notes:
            - Rack / RackUnit are optional (alternative to Location)
            - DestinationPorts optional (0 placeholder if missing)
            - Speed / Description optional on connections
    .PARAMETER DeviceCsvFile
        Path to device CSV file.
    .PARAMETER ConnectionCsvFile
        Optional path to connections CSV file.
    .OUTPUTS
        PSCustomObject with .devices and .connections collections.
    #>
    [CmdletBinding()] 
    param(
        [Parameter(Mandatory = $true)]
        [string]$DeviceCsvFile,
        [Parameter(Mandatory = $false)]
        [string]$ConnectionCsvFile
    )

    Write-PortMapLog "Parsing devices CSV: $DeviceCsvFile" -Level Info
    $deviceRows = Import-Csv -Path $DeviceCsvFile

    if (-not $deviceRows -or $deviceRows.Count -eq 0) {
        throw "Devices CSV is empty: $DeviceCsvFile"
    }

    # Group rows by device to aggregate port ranges
    $deviceGroups = $deviceRows | Group-Object -Property DeviceName
    $devices = [System.Collections.Generic.List[object]]::new()

    foreach ($group in $deviceGroups) {
        $first = $group.Group | Select-Object -First 1
        $portRanges = [System.Collections.Generic.List[object]]::new()
        foreach ($row in $group.Group) {
            if (-not $row.PortRange) { continue }
            $portRanges.Add([PSCustomObject]@{ range = $row.PortRange; mediaType = $row.MediaType; speed = $row.Speed; description = $row.Description })
        }

        if ($portRanges.Count -eq 0) { Write-PortMapLog "Device '$($group.Name)' has no valid PortRange entries" -Level Warning }

        $deviceObj = [PSCustomObject]@{
            deviceName = $group.Name
            deviceMake = $first.DeviceMake
            deviceModel = $first.DeviceModel
            location = if ($first.Location) { $first.Location } else { $null }
            rack = if ($first.Rack) { $first.Rack } else { $null }
            rackUnit = if ($first.RackUnit) { $first.RackUnit } else { $null }
            portRanges = $portRanges
        }
        $devices.Add($deviceObj)
    }

    $connections = @()
    if ($ConnectionCsvFile) {
        if (Test-Path -Path $ConnectionCsvFile -PathType Leaf) {
            Write-PortMapLog "Parsing connections CSV: $ConnectionCsvFile" -Level Info
            $connectionRows = Import-Csv -Path $ConnectionCsvFile
            $connList = [System.Collections.Generic.List[object]]::new()
            foreach ($row in $connectionRows) {
                if (-not $row.SourceDevice -or -not $row.SourcePorts) { 
                    Write-PortMapLog "Skipping connection row missing SourceDevice or SourcePorts" -Level Warning
                    continue 
                }
                $connList.Add([PSCustomObject]@{
                        sourceDevice = $row.SourceDevice
                        sourcePorts = $row.SourcePorts
                        sourceMedia = $row.SourceMedia
                        destinationDevice = $row.DestinationDevice
                        destinationPorts = if ($row.DestinationPorts) { $row.DestinationPorts } else { '0' }
                        destinationMedia = $row.DestinationMedia
                        connectionType = $row.ConnectionType
                        notes = $row.Notes
                    })
            }
            $connections = $connList.ToArray()
        }
        else {
            Write-PortMapLog "Connections CSV file not found: $ConnectionCsvFile" -Level Warning
        }
    }

    return [PSCustomObject]@{ devices = $devices.ToArray(); connections = $connections }
}

function Test-NetworkConfiguration {
    <#
    .SYNOPSIS
        Validates the JSON network configuration structure.
    
    .DESCRIPTION
        Performs comprehensive validation of the input JSON configuration to ensure
        all required fields are present and properly formatted.
    
    .PARAMETER Configuration
        The configuration object to validate.
    
    .OUTPUTS
        System.Boolean
        Returns $true if configuration is valid, $false otherwise.
    #>
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [object]$Configuration
    )
    
    Write-PortMapLog "Validating JSON configuration..." -Level Info
    
    # Validate devices section
    if (-not $Configuration.devices) {
        $Script:ValidationErrors.Add("Missing 'devices' section in configuration")
        return $false
    }
    
    foreach ($device in $Configuration.devices) {
        if (-not $device.deviceName) {
            $Script:ValidationErrors.Add("Device missing 'deviceName' property")
        }
        if (-not $device.deviceMake) {
            $Script:ValidationErrors.Add("Device '$($device.deviceName)' missing 'deviceMake' property")
        }
        if (-not $device.deviceModel) {
            $Script:ValidationErrors.Add("Device '$($device.deviceName)' missing 'deviceModel' property")
        }
        if (-not $device.portRanges) {
            $Script:ValidationErrors.Add("Device '$($device.deviceName)' missing 'portRanges' property")
        }
        
        # Validate port ranges structure
        if ($device.portRanges) {
            foreach ($portRange in $device.portRanges) {
                if (-not $portRange.range) {
                    $Script:ValidationErrors.Add("Device '$($device.deviceName)' has port range missing 'range' property")
                }
                if (-not $portRange.mediaType) {
                    $Script:ValidationErrors.Add("Device '$($device.deviceName)' has port range missing 'mediaType' property")
                }
            }
        }
    }
    
    # Validate connections section
    if ($Configuration.connections) {
        foreach ($connection in $Configuration.connections) {
            if (-not $connection.sourceDevice) {
                $Script:ValidationErrors.Add("Connection missing 'sourceDevice' property")
            }
            if (-not $connection.destinationDevice) {
                $Script:ValidationErrors.Add("Connection missing 'destinationDevice' property")
            }
            if (-not $connection.sourcePorts) {
                $Script:ValidationErrors.Add("Connection missing 'sourcePorts' property")
            }
        }
    }
    
    if ($Script:ValidationErrors.Count -gt 0) {
        foreach ($validationError in $Script:ValidationErrors) {
            Write-PortMapLog $validationError -Level Error
        }
        return $false
    }
    
    Write-PortMapLog "Configuration validation passed" -Level Info
    return $true
}

function Expand-NetworkPortRange {
    <#
    .SYNOPSIS
        Expands port range notation into individual port numbers or breakout interfaces.
    
    .DESCRIPTION
        Converts port range strings like "1-48" into arrays of individual port numbers.
        Also handles single port numbers and breakout cable interfaces (e.g., "1.1-1.4").
        Breakout cables use the format [primary].[sub] where QSFP interfaces can be
        split into multiple sub-interfaces.
    
    .PARAMETER Range
        The port range string to expand. Examples:
        - "1-48" (standard range)
        - "25" (single port)
        - "1.1-1.4" (breakout cable range)
        - "1.1" (single breakout interface)
    
    .OUTPUTS
        System.Object[]
        Array of individual port identifiers (integers for standard ports, strings for breakout interfaces).
    #>
    [CmdletBinding()]
    [OutputType([object[]])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Range
    )
    
    $Range = $Range.Trim()
    
    # Handle breakout cable ranges (e.g., "1.1-1.4")
    if ($Range -match '^(\d+)\.(\d+)-(\d+)\.(\d+)$') {
        $startPrimary = [int]$matches[1]
        $startSub = [int]$matches[2]
        $endPrimary = [int]$matches[3]
        $endSub = [int]$matches[4]
        
        # Validate that primary interfaces match for breakout cables
        if ($startPrimary -ne $endPrimary) {
            Write-PortMapLog "Breakout cable range '$Range' spans multiple primary interfaces ($startPrimary to $endPrimary). This may not be intended." -Level Warning
        }
        
        if ($startSub -gt $endSub) {
            Write-PortMapLog "Invalid breakout range '$Range': start sub-interface ($startSub) is greater than end sub-interface ($endSub)" -Level Warning
            return @()
        }
        
        # Generate breakout sub-interfaces efficiently
        $interfaces = for ($sub = $startSub; $sub -le $endSub; $sub++) {
            "$startPrimary.$sub"
        }
        return $interfaces
    }
    # Handle single breakout interface (e.g., "1.1")
    elseif ($Range -match '^(\d+)\.(\d+)$') {
        return , @($Range)  # Use unary comma operator to prevent unwrapping
    }
    # Handle standard port ranges (e.g., "1-48")
    elseif ($Range -match '^(\d+)-(\d+)$') {
        $start = [int]$matches[1]
        $end = [int]$matches[2]
        
        if ($start -gt $end) {
            Write-PortMapLog "Invalid port range '$Range': start ($start) is greater than end ($end)" -Level Warning
            return @()
        }
        
        if ($start -lt 1 -or $end -gt 999) {
            Write-PortMapLog "Port range '$Range' has unusual values (expected 1-999)" -Level Warning
        }
        
        return $start..$end
    }
    # Handle single standard port (e.g., "25")
    elseif ($Range -match '^\d+$') {
        return @([int]$Range)
    }
    else {
        Write-PortMapLog "Invalid port range format: '$Range'. Expected formats: '1-48', '25', '1.1-1.4', or '1.1'" -Level Warning
        return @()
    }
}

function New-UniqueOutputFileName {
    <#
    .SYNOPSIS
        Generates a unique output filename with device information and incremental numbering.
    
    .DESCRIPTION
        Creates a filename that includes input parameters, device information, and ensures
        uniqueness by adding incremental numbers if the file already exists.
    
    .PARAMETER InputFile
        The original input file path.
    
    .PARAMETER OutputFormat
        The desired output format (JSON, CSV, Markdown).
    
    .PARAMETER Devices
        Array of device objects containing deviceName, deviceMake, and deviceModel.
    
    .PARAMETER OutputFile
        Optional explicit output file path.
    
    .OUTPUTS
        System.String
        Returns the unique output file path.
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $false)]
        [string]$InputFile,
        
        [Parameter(Mandatory = $true)]
        [string]$OutputFormat,
        
        [Parameter(Mandatory = $true)]
        [array]$Devices,
        
        [Parameter(Mandatory = $false)]
        [string]$OutputFile
    )
    
    if (-not $InputFile -or $InputFile -eq '') {
        $InputFile = 'csv-import'
    }

    if ($OutputFile) {
        # If explicit output file is provided, ensure it has a full path
        if ([System.IO.Path]::IsPathRooted($OutputFile)) {
            $baseFileName = $OutputFile
        }
        else {
            $baseFileName = Join-Path -Path (Get-Location) -ChildPath $OutputFile
        }
    }
    else {
        # Generate filename with device information
        $inputBaseName = [System.IO.Path]::GetFileNameWithoutExtension($InputFile)
        $extension = switch ($OutputFormat.ToLower()) {
            "csv" { "csv" }
            "json" { "json" }
            default { "md" }
        }
        
        # Extract unique device makes and models
        $deviceMakes = $Devices | Select-Object -ExpandProperty deviceMake -Unique | Sort-Object
        $deviceModels = $Devices | Select-Object -ExpandProperty deviceModel -Unique | Sort-Object
        $deviceCount = $Devices.Count
        
        # Create a compact device identifier
        $makeString = ($deviceMakes -join "-").Replace(" ", "")
        $modelString = ($deviceModels -join "-").Replace(" ", "").Replace("/", "-")
        
        # For CSV format with single device, include device name in filename
        if ($OutputFormat.ToLower() -eq "csv" -and $deviceCount -eq 1) {
            $deviceName = $Devices[0].deviceName
            $sanitizedDeviceName = $deviceName -replace '[^\w\-.]', '_'
            $deviceInfo = "$sanitizedDeviceName-$makeString-$modelString"
            $baseFileName = Join-Path -Path (Get-Location) -ChildPath "$inputBaseName-$deviceInfo-portmap.$extension"
        }
        else {
            # Generate base filename with device info (for multi-device or non-CSV formats)
            $deviceInfo = "$makeString-$modelString-$($deviceCount)dev"
            $baseFileName = Join-Path -Path (Get-Location) -ChildPath "$inputBaseName-$deviceInfo-portmap.$extension"
        }
    }
    
    # Check if file exists and create unique name if needed
    $finalFileName = $baseFileName
    $counter = 1
    
    while (Test-Path -Path $finalFileName) {
        $directory = Split-Path -Path $baseFileName -Parent
        if (-not $directory) {
            $directory = Get-Location
        }
        $nameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($baseFileName)
        $extension = [System.IO.Path]::GetExtension($baseFileName)
        
        # Remove previous counter if it exists
        if ($nameWithoutExt -match '(.+)-(\d+)$') {
            $nameWithoutExt = $matches[1]
        }
        
        $finalFileName = Join-Path -Path $directory -ChildPath "$nameWithoutExt-$counter$extension"
        $counter++
    }
    
    return $finalFileName
}

function Get-NetworkDevicePortInfo {
    <#
    .SYNOPSIS
        Extracts port information from a device configuration.
    
    .DESCRIPTION
        Processes device configuration to create a comprehensive port information structure
        including total ports, port details, and usage tracking.
    
    .PARAMETER Device
        The device configuration object.
    
    .OUTPUTS
        System.Collections.Hashtable
        Hashtable containing port information and details.
    #>
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [object]$Device
    )
    
    $portInfo = @{
        TotalPorts  = 0
        UsedPorts   = [System.Collections.Generic.List[object]]::new()
        UnusedPorts = [System.Collections.Generic.List[object]]::new()
        PortDetails = @{}
    }
    
    # Calculate total ports and create port details
    foreach ($portRange in $Device.portRanges) {
        $ports = Expand-NetworkPortRange -Range $portRange.range
        $portInfo.TotalPorts += @($ports).Count
        
        foreach ($port in $ports) {
            $portInfo.PortDetails[$port] = @{
                MediaType   = $portRange.mediaType
                Speed       = if ($null -ne $portRange.speed -and $portRange.speed -ne '') { $portRange.speed } else { "Unknown" }
                Description = if ($null -ne $portRange.description -and $portRange.description -ne '') { $portRange.description } else { "No description" }
                IsUsed      = $false
                Connection  = $null
            }
        }
    }
    
    return $portInfo
}

function New-ConnectionMappings {
    <#
    .SYNOPSIS
        Creates connection mappings from configuration data.
    
    .DESCRIPTION
        Processes connection configurations to create detailed port-to-port mappings
        and updates device port usage information.
    
    .PARAMETER Connections
        Array of connection configuration objects.
    
    .PARAMETER DevicePortInfo
        Hashtable of device port information to update.
    
    .OUTPUTS
        System.Object[]
        Array of connection mapping objects.
    #>
    [CmdletBinding()]
    [OutputType([object[]])]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$Connections,
        
        [Parameter(Mandatory = $true)]
        [hashtable]$DevicePortInfo
    )
    
    $connectionMappings = [System.Collections.Generic.List[object]]::new()
    
    foreach ($connection in $Connections) {
        try {
            # Parse source ports with error context
            $sourcePorts = Expand-NetworkPortRange -Range $connection.sourcePorts
            if ($null -eq $sourcePorts -or @($sourcePorts).Count -eq 0) {
                throw "Failed to parse source ports: '$($connection.sourcePorts)'"
            }
            
            # Parse destination ports with error context
            $destPorts = if ($connection.destinationPorts) { 
                $destPortsResult = Expand-NetworkPortRange -Range $connection.destinationPorts
                # Allow empty results for destination ports (port 0 or invalid formats are handled gracefully)
                if ($null -eq $destPortsResult) {
                    Write-PortMapLog "Could not parse destination ports '$($connection.destinationPorts)' for connection from '$($connection.sourceDevice)' to '$($connection.destinationDevice)', using port 0 as placeholder" -Level Warning
                    @(0) * @($sourcePorts).Count
                }
                elseif (@($destPortsResult).Count -eq 0) {
                    Write-PortMapLog "Destination ports '$($connection.destinationPorts)' for connection from '$($connection.sourceDevice)' to '$($connection.destinationDevice)' resulted in empty range, using port 0 as placeholder" -Level Warning
                    @(0) * @($sourcePorts).Count
                }
                else {
                    $destPortsResult
                }
            }
            else { 
                @(0) * @($sourcePorts).Count 
            }
        }
        catch {
            $errorMsg = "Connection processing failed - SourceDevice: '$($connection.sourceDevice)', SourcePorts: '$($connection.sourcePorts)', DestinationDevice: '$($connection.destinationDevice)', DestinationPorts: '$($connection.destinationPorts)'. Error: $($_.Exception.Message)"
            Write-PortMapLog $errorMsg -Level Error
            throw $errorMsg
        }
        
        for ($i = 0; $i -lt @($sourcePorts).Count; $i++) {
            $sourcePort = $sourcePorts[$i]
            $destPort = if ($i -lt @($destPorts).Count) { $destPorts[$i] } else { $destPorts[0] }
            
            # Mark source port as used
            if ($DevicePortInfo.ContainsKey($connection.sourceDevice)) {
                if ($DevicePortInfo[$connection.sourceDevice].PortDetails.ContainsKey($sourcePort)) {
                    $DevicePortInfo[$connection.sourceDevice].PortDetails[$sourcePort].IsUsed = $true
                    $DevicePortInfo[$connection.sourceDevice].PortDetails[$sourcePort].Connection = $connection.destinationDevice
                    $DevicePortInfo[$connection.sourceDevice].UsedPorts.Add($sourcePort)
                }
            }
            
            # Create connection mapping
            $mapping = [PSCustomObject]@{
                SourceDevice      = $connection.sourceDevice
                SourcePort        = $sourcePort
                SourceMedia       = if ($null -ne $connection.sourceMedia -and $connection.sourceMedia -ne '') { $connection.sourceMedia } else { "Unknown" }
                DestinationDevice = $connection.destinationDevice
                DestinationPort   = $destPort
                DestinationMedia  = if ($null -ne $connection.destinationMedia -and $connection.destinationMedia -ne '') { $connection.destinationMedia } else { "Unknown" }
                Status            = "Active"
                ConnectionType    = if ($null -ne $connection.connectionType -and $connection.connectionType -ne '') { $connection.connectionType } else { "Unknown" }
                Notes             = if ($null -ne $connection.notes) { $connection.notes } else { "" }
            }
            
            $connectionMappings.Add($mapping)
        }
    }
    
    # Update unused ports
    foreach ($deviceName in $DevicePortInfo.Keys) {
        $device = $DevicePortInfo[$deviceName]
        $unusedPorts = $device.PortDetails.Keys | Where-Object { -not $device.PortDetails[$_].IsUsed }
        $device.UnusedPorts.Clear()
        foreach ($port in $unusedPorts) {
            $device.UnusedPorts.Add($port)
        }
    }
    
    return $connectionMappings.ToArray()
}

function Get-ConsolidatedPortEntries {
    <#
    .SYNOPSIS
        Creates a consolidated list of port entries for a device including connections and unused ports.
    
    .DESCRIPTION
        Helper function to generate a unified, sorted list of port entries combining
        connection data and unused port information for output generation.
    
    .PARAMETER DeviceName
        Name of the device to process.
    
    .PARAMETER DevicePortInfo
        Hashtable containing device port information.
    
    .PARAMETER ConnectionMappings
        Array of all connection mapping objects.
    
    .PARAMETER IncludeUnused
        Whether to include unused ports in the output.
    
    .OUTPUTS
        System.Object[]
        Sorted array of port entry objects.
    #>
    [CmdletBinding()]
    [OutputType([object[]])]
    param(
        [Parameter(Mandatory = $true)]
        [string]$DeviceName,
        
        [Parameter(Mandatory = $true)]
        [hashtable]$DevicePortInfo,
        
        [Parameter(Mandatory = $false)]
        [AllowEmptyCollection()]
        [object[]]$ConnectionMappings = @(),
        
        [Parameter(Mandatory = $false)]
        [bool]$IncludeUnused = $false
    )
    
    $portInfo = $DevicePortInfo[$DeviceName]
    $allPortEntries = [System.Collections.Generic.List[object]]::new()
    
    # Get connections for this device
    $deviceConnections = if ($ConnectionMappings -and $ConnectionMappings.Count -gt 0) { 
        $ConnectionMappings | Where-Object { $_.SourceDevice -eq $DeviceName }
    } else { 
        @() 
    }
    
    # Add connected ports
    foreach ($connection in $deviceConnections) {
        $portEntry = [PSCustomObject]@{
            PortNumber        = if ($connection.SourcePort -match '^\d+$') { [int]$connection.SourcePort } else { [int]($connection.SourcePort -replace '\..*$', '') }
            Port              = $connection.SourcePort
            Media             = $connection.SourceMedia
            Status            = $connection.Status
            DestinationDevice = $connection.DestinationDevice
            DestinationPort   = $connection.DestinationPort
            DestinationMedia  = $connection.DestinationMedia
            Type              = $connection.ConnectionType
            Notes             = if ($connection.Notes) { $connection.Notes } else { "" }
            IsConnected       = $true
        }
        $allPortEntries.Add($portEntry)
    }
    
    # Add unused ports if requested
    if ($IncludeUnused -and $portInfo.UnusedPorts -and $portInfo.UnusedPorts.Count -gt 0) {
        foreach ($port in $portInfo.UnusedPorts) {
            $details = $portInfo.PortDetails[$port]
            $portEntry = [PSCustomObject]@{
                PortNumber        = if ($port -match '^\d+$') { [int]$port } else { [int]($port -replace '\..*$', '') }
                Port              = $port
                Media             = $details.MediaType
                Status            = "Unused"
                DestinationDevice = ""
                DestinationPort   = ""
                DestinationMedia  = ""
                Type              = ""
                Notes             = "Available"
                IsConnected       = $false
            }
            $allPortEntries.Add($portEntry)
        }
    }
    
    # Sort by port number and return
    return ($allPortEntries | Sort-Object PortNumber)
}

#endregion

#region Output Generators

function ConvertTo-MarkdownOutput {
    <#
    .SYNOPSIS
        Converts port mapping data to Markdown format.
    
    .DESCRIPTION
        Creates human-readable Markdown tables for network documentation including
        device summaries, connection mappings, and optionally unused ports.
    
    .PARAMETER Devices
        Array of device configuration objects.
    
    .PARAMETER DevicePortInfo
        Hashtable containing device port information.
    
    .PARAMETER ConnectionMappings
        Array of connection mapping objects.
    
    .PARAMETER InputFile
        Path to the input JSON configuration file.
    
    .PARAMETER OutputFormat
        The output format being used.
    
    .OUTPUTS
        System.String
        Formatted Markdown documentation.
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Devices,
        
        [Parameter(Mandatory = $true)]
        [hashtable]$DevicePortInfo,
        
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$ConnectionMappings,
        
        [Parameter(Mandatory = $false)]
        [string]$InputFile,
        
        [Parameter(Mandatory = $false)]
        [string]$OutputFormat
    )
    
    $markdownBuilder = [System.Text.StringBuilder]::new()
    
    # Header with metadata
    [void]$markdownBuilder.AppendLine("# Network Port Mapping Documentation")
    [void]$markdownBuilder.AppendLine("")
    [void]$markdownBuilder.AppendLine("**Generated on:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    [void]$markdownBuilder.AppendLine("**Tool:** PortMap v1.0")
    if ($InputFile) {
        [void]$markdownBuilder.AppendLine("**Input File:** $(Split-Path -Leaf $InputFile)")
    }
    $effectiveFormat = if ($OutputFormat) { $OutputFormat } else { 'Markdown' }
    [void]$markdownBuilder.AppendLine("**Output Format:** $effectiveFormat")
    [void]$markdownBuilder.AppendLine("**Generated by:** $env:USERNAME on $env:COMPUTERNAME")
    [void]$markdownBuilder.AppendLine("")
    
    # Device Information Summary
    $deviceMakes = $Devices | Select-Object -ExpandProperty deviceMake -Unique | Sort-Object
    $deviceModels = $Devices | Select-Object -ExpandProperty deviceModel -Unique | Sort-Object
    [void]$markdownBuilder.AppendLine("**Device Makes:** $($deviceMakes -join ', ')")
    [void]$markdownBuilder.AppendLine("**Device Models:** $($deviceModels -join ', ')")
    [void]$markdownBuilder.AppendLine("**Total Devices:** $($Devices.Count)")
    [void]$markdownBuilder.AppendLine("")
    
    # Device Summary Table
    [void]$markdownBuilder.AppendLine("## Device Summary")
    [void]$markdownBuilder.AppendLine("")
    [void]$markdownBuilder.AppendLine("| Device Name | Make | Model | Total Ports | Used Ports | Unused Ports |")
    [void]$markdownBuilder.AppendLine("|-------------|------|-------|-------------|------------|--------------|")
    
    foreach ($device in $Devices) {
        $portInfo = $DevicePortInfo[$device.deviceName]
        $usedCount = if ($portInfo.UsedPorts) { @($portInfo.UsedPorts).Count } else { 0 }
        $unusedCount = if ($portInfo.UnusedPorts) { @($portInfo.UnusedPorts).Count } else { 0 }
        [void]$markdownBuilder.AppendLine("| $($device.deviceName) | $($device.deviceMake) | $($device.deviceModel) | $($portInfo.TotalPorts) | $usedCount | $unusedCount |")
    }
    
    [void]$markdownBuilder.AppendLine("")
    
    # Connection and Port Tables - Individual tables per device
    [void]$markdownBuilder.AppendLine("## Port Mapping by Device")
    [void]$markdownBuilder.AppendLine("")
    
    foreach ($device in $Devices) {
        $deviceName = $device.deviceName
        $deviceMake = $device.deviceMake
        $deviceModel = $device.deviceModel
        $portInfo = $DevicePortInfo[$deviceName]
        
        # Get connections for this device
        $deviceConnections = if ($ConnectionMappings) { 
            $ConnectionMappings | Where-Object { $_.SourceDevice -eq $deviceName } | Sort-Object { [int]$_.SourcePort }
        }
        else { 
            @() 
        }
        
        # Calculate counts
        $connectionCount = if ($deviceConnections) { @($deviceConnections).Count } else { 0 }
        $unusedPortCount = if ($ShowUnused -and $portInfo.UnusedPorts) { @($portInfo.UnusedPorts).Count } else { 0 }
        $totalRowCount = $connectionCount + $unusedPortCount
        
        [void]$markdownBuilder.AppendLine("### $deviceName")
        [void]$markdownBuilder.AppendLine("")
        [void]$markdownBuilder.AppendLine("**Device:** $deviceName ($deviceMake $deviceModel)")
        [void]$markdownBuilder.AppendLine("**Total Ports:** $($portInfo.TotalPorts)")
        [void]$markdownBuilder.AppendLine("**Connected Ports:** $connectionCount")
        if ($ShowUnused) {
            [void]$markdownBuilder.AppendLine("**Unused Ports:** $unusedPortCount")
        }
        [void]$markdownBuilder.AppendLine("")
        
        if ($totalRowCount -gt 0) {
            [void]$markdownBuilder.AppendLine("| Port | Media | Status | Destination Device | Destination Port | Destination Media | Type | Notes |")
            [void]$markdownBuilder.AppendLine("|------|-------|--------|-------------------|------------------|-------------------|------|-------|")
            
            # Use helper function to get consolidated port entries
            $sortedPortEntries = Get-ConsolidatedPortEntries -DeviceName $deviceName -DevicePortInfo $DevicePortInfo -ConnectionMappings $ConnectionMappings -IncludeUnused $ShowUnused
            
            foreach ($portEntry in $sortedPortEntries) {
                $status = if ($portEntry.IsConnected) { $portEntry.Status } else { "**Unused**" }
                $destDevice = if ($portEntry.DestinationDevice -and $portEntry.DestinationDevice -ne '') { $portEntry.DestinationDevice } else { "-" }
                $destPort = if ($portEntry.DestinationPort -and $portEntry.DestinationPort -ne '' -and $portEntry.DestinationPort -ne '0') { $portEntry.DestinationPort } else { "-" }
                $destMedia = if ($portEntry.DestinationMedia -and $portEntry.DestinationMedia -ne '') { $portEntry.DestinationMedia } else { "-" }
                $type = if ($portEntry.Type -and $portEntry.Type -ne '') { $portEntry.Type } else { "-" }
                
                [void]$markdownBuilder.AppendLine("| $($portEntry.Port) | $($portEntry.Media) | $status | $destDevice | $destPort | $destMedia | $type | $($portEntry.Notes) |")
            }
        }
        else {
            [void]$markdownBuilder.AppendLine("*No port connections or unused ports to display for this device.*")
        }
        
        [void]$markdownBuilder.AppendLine("")
    }
    
    return $markdownBuilder.ToString()
}

function ConvertTo-CsvOutput {
    <#
    .SYNOPSIS
        Converts port mapping data to individual CSV files per device.
    
    .DESCRIPTION
        Creates individual CSV files for each device with structured data suitable for 
        spreadsheet applications and data processing. Each device gets its own CSV file
        with complete port information, connections, and metadata.
    
    .PARAMETER Devices
        Array of device configuration objects.
    
    .PARAMETER DevicePortInfo
        Hashtable containing device port information.
    
    .PARAMETER ConnectionMappings
        Array of connection mapping objects.
    
    .PARAMETER InputFile
        Path to the input JSON configuration file.
    
    .PARAMETER OutputFormat
        The output format being used.
    
    .PARAMETER ShowUnused
        Include unused ports in the CSV output.
    
    .OUTPUTS
        System.Collections.Hashtable
        Hashtable containing device names as keys and CSV data arrays as values.
    #>
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Devices,
        
        [Parameter(Mandatory = $true)]
        [hashtable]$DevicePortInfo,
        
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$ConnectionMappings,
        
        [Parameter(Mandatory = $false)]
        [string]$InputFile,
        
        [Parameter(Mandatory = $false)]
        [string]$OutputFormat,
        
        [Parameter(Mandatory = $false)]
        [switch]$ShowUnused
    )
    
    # Create a hashtable to store CSV data for each device
    $deviceCsvFiles = @{}
    
    foreach ($device in $Devices) {
        $deviceName = $device.deviceName
        $csvData = [System.Collections.Generic.List[object]]::new()
        
        # Use helper function to get consolidated port entries
        $sortedPortEntries = Get-ConsolidatedPortEntries -DeviceName $deviceName -DevicePortInfo $DevicePortInfo -ConnectionMappings $ConnectionMappings -IncludeUnused $ShowUnused
        
        foreach ($portEntry in $sortedPortEntries) {
            $csvRow = [PSCustomObject]@{
                DeviceName        = $deviceName
                Make              = $device.deviceMake
                Model             = $device.deviceModel
                Location          = if ($device.PSObject.Properties.Name -contains 'location' -and $device.location) { 
                    $device.location 
                } elseif ($device.rack -and $device.rackUnit) { 
                    "$($device.rack)/$($device.rackUnit)" 
                } elseif ($device.rack) { 
                    $device.rack 
                } else { 
                    "" 
                }
                Port              = $portEntry.Port
                Media             = $portEntry.Media
                Status            = $portEntry.Status
                DestinationDevice = $portEntry.DestinationDevice
                DestinationPort   = $portEntry.DestinationPort
                DestinationMedia  = $portEntry.DestinationMedia
                Type              = $portEntry.Type
                Notes             = $portEntry.Notes
            }
            $csvData.Add($csvRow)
        }
        
        # Store CSV data for this device
        $deviceCsvFiles[$deviceName] = $csvData.ToArray()
    }
    
    return $deviceCsvFiles
}

function ConvertTo-JsonOutput {
    <#
    .SYNOPSIS
        Converts port mapping data to JSON format.
    
    .DESCRIPTION
        Creates machine-readable JSON output suitable for integration with other tools
        and programmatic consumption.
    
    .PARAMETER Devices
        Array of device configuration objects.
    
    .PARAMETER DevicePortInfo
        Hashtable containing device port information.
    
    .PARAMETER ConnectionMappings
        Array of connection mapping objects.
    
    .PARAMETER InputFile
        Path to the input JSON configuration file.
    
    .PARAMETER OutputFormat
        The output format being used.
    
    .OUTPUTS
        System.String
        JSON-formatted string containing all port mapping data.
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Devices,
        
        [Parameter(Mandatory = $true)]
        [hashtable]$DevicePortInfo,
        
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$ConnectionMappings,
        
        [Parameter(Mandatory = $false)]
        [string]$InputFile,
        
        [Parameter(Mandatory = $false)]
        [string]$OutputFormat
    )
    
    # Collect device information for metadata - with safe property extraction
    $deviceMakes = @()
    $deviceModels = @()
    $deviceNames = @()
    
    try {
        $deviceMakes = $Devices | Where-Object { $null -ne $_.deviceMake } | ForEach-Object { $_.deviceMake } | Select-Object -Unique | Sort-Object
        $deviceModels = $Devices | Where-Object { $null -ne $_.deviceModel } | ForEach-Object { $_.deviceModel } | Select-Object -Unique | Sort-Object
        $deviceNames = $Devices | Where-Object { $null -ne $_.deviceName } | ForEach-Object { $_.deviceName } | Sort-Object
    }
    catch {
        Write-PortMapLog "Warning: Error collecting device metadata: $($_.Exception.Message)" -Level Warning
        # Continue with empty arrays
    }
    
    $jsonOutput = [ordered]@{
        metadata    = [ordered]@{
            generatedOn   = (Get-Date -Format "o")
            tool          = "PortMap"
            version       = "1.0"
            generatedBy   = $env:USERNAME
            computerName  = $env:COMPUTERNAME
            inputFile     = if ($InputFile) { Split-Path -Leaf $InputFile } else { "Unknown" }
            outputFormat  = if ($OutputFormat) { $OutputFormat } else { "JSON" }
            deviceSummary = [ordered]@{
                deviceNames  = $deviceNames
                deviceMakes  = $deviceMakes
                deviceModels = $deviceModels
                deviceCount  = $Devices.Count
            }
        }
        summary     = [ordered]@{
            totalDevices     = if ($Devices) { @($Devices).Count } else { 0 }
            totalConnections = if ($ConnectionMappings) { @($ConnectionMappings).Count } else { 0 }
            totalPorts       = ($DevicePortInfo.Values | ForEach-Object { if ($_.TotalPorts) { $_.TotalPorts } else { 0 } } | Measure-Object -Sum).Sum
            totalUsedPorts   = ($DevicePortInfo.Values | ForEach-Object { if ($_.UsedPorts) { @($_.UsedPorts).Count } else { 0 } } | Measure-Object -Sum).Sum
        }
        devices     = [System.Collections.Generic.List[object]]::new()
        connections = $ConnectionMappings
    }
    
    foreach ($device in $Devices) {
        $portInfo = $DevicePortInfo[$device.deviceName]
        
        $deviceData = [ordered]@{
            deviceName  = $device.deviceName
            deviceMake  = $device.deviceMake
            deviceModel = $device.deviceModel
            location    = if ($device.PSObject.Properties.Name -contains 'location') { $device.location } elseif ($device.rack -and $device.rackUnit) { "$($device.rack)/$($device.rackUnit)" } elseif ($device.rack) { $device.rack } else { "" }
            portSummary = [ordered]@{
                totalPorts         = $portInfo.TotalPorts
                usedPorts          = if ($portInfo.UsedPorts) { @($portInfo.UsedPorts).Count } else { 0 }
                unusedPorts        = if ($portInfo.UnusedPorts) { @($portInfo.UnusedPorts).Count } else { 0 }
                utilizationPercent = if ($portInfo.TotalPorts -gt 0) { 
                    $usedPortCount = if ($portInfo.UsedPorts) { @($portInfo.UsedPorts).Count } else { 0 }
                    [math]::Round(($usedPortCount / $portInfo.TotalPorts) * 100, 2) 
                }
                else { 
                    0 
                }
            }
            portDetails = [System.Collections.Generic.List[object]]::new()
        }
        
        $sortedPorts = $portInfo.PortDetails.Keys | Sort-Object
        foreach ($portNum in $sortedPorts) {
            $portDetail = $portInfo.PortDetails[$portNum]
            $portDetailObj = [ordered]@{
                port        = $portNum
                mediaType   = $portDetail.MediaType
                speed       = $portDetail.Speed
                description = $portDetail.Description
                isUsed      = $portDetail.IsUsed
                connection  = $portDetail.Connection
            }
            $deviceData.portDetails.Add($portDetailObj)
        }
        
        $unusedPortCount = if ($portInfo.UnusedPorts) { @($portInfo.UnusedPorts).Count } else { 0 }
        if ($ShowUnused -and $unusedPortCount -gt 0) {
            $deviceData.unusedPorts = ($portInfo.UnusedPorts | Sort-Object)
        }
        
        $jsonOutput.devices.Add($deviceData)
    }
    
    try {
        return ($jsonOutput | ConvertTo-Json -Depth 15 -Compress:$false)
    }
    catch {
        Write-PortMapLog "Failed to convert to JSON: $($_.Exception.Message)" -Level Error
        throw
    }
}

#endregion

#region Main Execution

function Start-PortMappingProcess {
    <#
    .SYNOPSIS
        Main execution function for the PortMap tool.
    
    .DESCRIPTION
        Orchestrates the entire port mapping process including configuration loading,
        validation, processing, and output generation.
    
    .NOTES
        This function handles all error conditions and provides comprehensive logging.
    #>
    [CmdletBinding()]
    param()
    
    try {
        Write-PortMapLog "Starting PortMap Tool v1.0" -Level Info
        $effectiveInputFile = $null
        if ($PSCmdlet.ParameterSetName -like 'Json*') {
            Write-PortMapLog "Input file (JSON): $InputFile" -Level Info
            $effectiveInputFile = $InputFile
        }
        elseif ($PSCmdlet.ParameterSetName -like 'Csv*') {
            Write-PortMapLog "Input files (CSV): Devices=$DeviceCsvFile Connections=$ConnectionCsvFile" -Level Info
            # Synthesize pseudo input name for metadata / filenames
            $effectiveInputFile = (Split-Path -Leaf $DeviceCsvFile)
        }
        Write-PortMapLog "Output format: $OutputFormat" -Level Info
        
        # Load configuration (JSON or CSV) into canonical object $configContent
        $configContent = $null
        if ($PSCmdlet.ParameterSetName -like 'Json*') {
            Write-PortMapLog "Loading configuration from JSON: $InputFile" -Level Info
            if (-not (Test-Path -Path $InputFile -PathType Leaf)) { throw "Input file does not exist: $InputFile" }
            try { $configContent = Get-Content -Path $InputFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop }
            catch { throw "Failed to parse JSON from input file: $($_.Exception.Message)" }
        }
        else {
            Write-PortMapLog "Loading configuration from CSV files" -Level Info
            try { $configContent = Import-PortMapCsvConfiguration -DeviceCsvFile $DeviceCsvFile -ConnectionCsvFile $ConnectionCsvFile }
            catch { throw "Failed to parse CSV input: $($_.Exception.Message)" }
        }
        
        if (-not (Test-NetworkConfiguration -Configuration $configContent)) {
            throw "Configuration validation failed. Please check the error messages above."
        }
        
        if ($Validate) {
            Write-PortMapLog "Configuration validation completed successfully" -Level Info
            return 0
        }
        
        # Filter devices if specified
    $devices = [array]$configContent.devices
        if ($DeviceFilter -and @($DeviceFilter).Count -gt 0) {
            $devices = $devices | Where-Object { $_.deviceName -in $DeviceFilter }
            Write-PortMapLog "Filtered to devices: $($DeviceFilter -join ', ')" -Level Info
            
            if (@($devices).Count -eq 0) {
                Write-PortMapLog "No devices matched the filter criteria" -Level Warning
                return 1
            }
        }
        
        # Build device port information
        Write-PortMapLog "Processing device port information..." -Level Info
        $devicePortInfo = @{}
        $deviceIndex = 0
        
        foreach ($device in $devices) {
            $deviceIndex++
            Write-Progress -Activity "Processing Devices" -Status "Processing $($device.deviceName) ($deviceIndex of $($devices.Count))" -PercentComplete (($deviceIndex / $devices.Count) * 100)
            
            try {
                $devicePortInfo[$device.deviceName] = Get-NetworkDevicePortInfo -Device $device
                Write-PortMapLog "Processed device: $($device.deviceName) ($($devicePortInfo[$device.deviceName].TotalPorts) ports)" -Level Info
            }
            catch {
                Write-Progress -Activity "Processing Devices" -Completed
                Write-PortMapLog "Failed to process device $($device.deviceName): $($_.Exception.Message)" -Level Error
                throw
            }
        }
        Write-Progress -Activity "Processing Devices" -Completed
        
        # Process connections
        Write-PortMapLog "Processing connections..." -Level Info
        $connectionMappings = @()
        
        if ($configContent.connections -and @($configContent.connections).Count -gt 0) {
            Write-Progress -Activity "Processing Connections" -Status "Mapping connections..." -PercentComplete 0
            try {
                $connectionMappings = New-ConnectionMappings -Connections $configContent.connections -DevicePortInfo $devicePortInfo
                $connectionCount = if ($connectionMappings) { @($connectionMappings).Count } else { 0 }
                Write-PortMapLog "Processed $connectionCount connections" -Level Info
            }
            catch {
                Write-Progress -Activity "Processing Connections" -Completed
                Write-PortMapLog "Failed to process connections: $($_.Exception.Message)" -Level Error
                throw
            }
            finally {
                Write-Progress -Activity "Processing Connections" -Completed
            }
        }
        else {
            Write-PortMapLog "No connections defined in configuration" -Level Info
        }
        
        # Generate output
        Write-PortMapLog "Generating $OutputFormat output..." -Level Info
        $output = $null
        
        try {
            $output = switch ($OutputFormat) {
                "Markdown" { 
                    ConvertTo-MarkdownOutput -Devices $devices -DevicePortInfo $devicePortInfo -ConnectionMappings $connectionMappings -InputFile $effectiveInputFile -OutputFormat $OutputFormat
                }
                "CSV" { 
                    ConvertTo-CsvOutput -Devices $devices -DevicePortInfo $devicePortInfo -ConnectionMappings $connectionMappings -InputFile $effectiveInputFile -OutputFormat $OutputFormat -ShowUnused:$ShowUnused
                }
                "JSON" { 
                    ConvertTo-JsonOutput -Devices $devices -DevicePortInfo $devicePortInfo -ConnectionMappings $connectionMappings -InputFile $effectiveInputFile -OutputFormat $OutputFormat
                }
                default {
                    throw "Unsupported output format: $OutputFormat"
                }
            }
        }
        catch {
            Write-PortMapLog "Failed to generate $OutputFormat output: $($_.Exception.Message)" -Level Error
            throw
        }
        
        # Handle output generation
        if ($OutputFormat -eq "CSV") {
            # CSV output creates individual files per device
            Write-PortMapLog "Creating individual CSV files per device..." -Level Info
            $outputFiles = @()
            
            try {
                foreach ($deviceName in $output.Keys) {
                    # Generate unique filename for each device
                    $deviceOutputFile = New-UniqueOutputFileName -InputFile $effectiveInputFile -OutputFormat $OutputFormat -Devices @($devices | Where-Object { $_.deviceName -eq $deviceName }) -OutputFile $OutputFile
                    
                    # Create output directory if needed
                    $outputDir = Split-Path -Path $deviceOutputFile -Parent
                    if ($outputDir -and -not (Test-Path -Path $outputDir)) {
                        New-Item -Path $outputDir -ItemType Directory -Force | Out-Null
                        Write-PortMapLog "Created output directory: $outputDir" -Level Info
                    }
                    
                    # Export CSV for this device
                    $output[$deviceName] | Export-Csv -Path $deviceOutputFile -NoTypeInformation -Encoding UTF8
                    
                    # Track output file information
                    $fileInfo = Get-Item -Path $deviceOutputFile
                    $outputFiles += $fileInfo
                    
                    Write-PortMapLog "Created CSV file for $deviceName" -Level Info
                    Write-PortMapLog "  File: $($fileInfo.Name)" -Level Info
                    Write-PortMapLog "  Size: $($fileInfo.Length) bytes" -Level Info
                }
                
                # Display summary of all files created
                Write-PortMapLog "CSV output files created:" -Level Info
                foreach ($fileInfo in $outputFiles) {
                    Write-PortMapLog "  $($fileInfo.FullName)" -Level Info
                }
                
                # Console output for first device if no explicit output file specified
                if (-not $OutputFile -and $outputFiles.Count -gt 0) {
                    Write-Host ""
                    Write-PortMapLog "Console Output (Sample - First Device):" -Level Info
                    $firstDeviceData = $output[($output.Keys | Select-Object -First 1)]
                    $firstDeviceData | Format-Table -AutoSize
                }
            }
            catch {
                Write-PortMapLog "Failed to write CSV output files: $($_.Exception.Message)" -Level Error
                throw
            }
        }
        else {
            # Single file output for Markdown and JSON
            $finalOutputFile = New-UniqueOutputFileName -InputFile $effectiveInputFile -OutputFormat $OutputFormat -Devices $devices -OutputFile $OutputFile
            
            try {
                $outputDir = Split-Path -Path $finalOutputFile -Parent
                if ($outputDir -and -not (Test-Path -Path $outputDir)) {
                    New-Item -Path $outputDir -ItemType Directory -Force | Out-Null
                    Write-PortMapLog "Created output directory: $outputDir" -Level Info
                }
                
                $output | Out-File -FilePath $finalOutputFile -Encoding UTF8 -Force
                
                # Display file information
                $fileInfo = Get-Item -Path $finalOutputFile
                Write-PortMapLog "Output written to file:" -Level Info
                Write-PortMapLog "  File: $($fileInfo.Name)" -Level Info
                Write-PortMapLog "  Location: $($fileInfo.DirectoryName)" -Level Info
                Write-PortMapLog "  Full Path: $($fileInfo.FullName)" -Level Info
                Write-PortMapLog "  Format: $OutputFormat" -Level Info
                Write-PortMapLog "  Size: $($fileInfo.Length) bytes" -Level Info
                
                # Also output to console if not explicitly specifying an output file
                if (-not $OutputFile) {
                    Write-Host ""
                    Write-PortMapLog "Console Output (truncated to first 200 lines):" -Level Info
                    ($output -split "`n" | Select-Object -First 200) -join "`n" | Write-Host
                }
            }
            catch {
                Write-PortMapLog "Failed to write output file: $($_.Exception.Message)" -Level Error
                throw
            }
        }
        
        # Display summary statistics
        $totalPorts = 0
        $usedPorts = 0
        foreach ($d in $devicePortInfo.GetEnumerator()) {
            if ($d.Value -and $d.Value.ContainsKey('TotalPorts')) { $totalPorts += [int]$d.Value.TotalPorts }
            if ($d.Value -and $d.Value.ContainsKey('UsedPorts') -and $d.Value.UsedPorts) { $usedPorts += [int](@($d.Value.UsedPorts).Count) }
        }
        $utilizationRate = if ($totalPorts -gt 0) { [math]::Round(($usedPorts / $totalPorts) * 100, 2) } else { 0 }
        $connectionCount = if ($connectionMappings) { @($connectionMappings).Count } else { 0 }
        
        Write-PortMapLog "Processing Summary:" -Level Info
        Write-PortMapLog "  Devices processed: $(if ($devices) { @($devices).Count } else { 0 })" -Level Info
        Write-PortMapLog "  Total ports: $totalPorts" -Level Info
        Write-PortMapLog "  Used ports: $usedPorts" -Level Info
        Write-PortMapLog "  Port utilization: $utilizationRate%" -Level Info
        Write-PortMapLog "  Connections mapped: $connectionCount" -Level Info
        
        if ($OutputFormat -eq "CSV") {
            Write-PortMapLog "  Output files: $($outputFiles.Count) CSV files (one per device)" -Level Info
            Write-PortMapLog "  Output location: $(Split-Path -Parent $outputFiles[0].FullName)" -Level Info
        }
        else {
            Write-PortMapLog "  Output file: $(Split-Path -Leaf $finalOutputFile)" -Level Info
            Write-PortMapLog "  Output location: $(Split-Path -Parent $finalOutputFile)" -Level Info
        }
        
        Write-PortMapLog "PortMap processing completed successfully" -Level Info
        return 0
        
    }
    catch {
        Write-PortMapLog "Critical error in PortMap processing: $($_.Exception.Message)" -Level Error
        
        if ($_.Exception.InnerException) {
            Write-PortMapLog "Inner exception: $($_.Exception.InnerException.Message)" -Level Error
        }
        
        # Write stack trace for debugging (only if in verbose mode)
        if ($VerbosePreference -eq 'Continue') {
            Write-PortMapLog "Stack trace: $($_.ScriptStackTrace)" -Level Error
        }
        
        return 1
    }
}

# Execute main function and exit with appropriate code
$exitCode = Start-PortMappingProcess
exit $exitCode

#endregion
