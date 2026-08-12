// Fixture provenance: borrowed from microsoft/vscode's Go colorize-tests
// (extensions/go/test/colorize-fixtures/test.go, MIT). Originally referenced
// the Azure SDK packages `management`/`vmutils`, which are not vendored here;
// the stubs below reproduce the exact call shapes so the file compiles and
// gopls can classify every identifier (docs/IMPROVEMENT-IDEAS.md item 22).
// Deleting the stubs degrades this fixture to guesswork, not semantic tokens.
package main

import (
	"encoding/base64"
	"fmt"
)

// ---- local stubs standing in for the Azure SDK packages ----

type role struct {
	Name string
}

type managementClient struct{}

type managementPkg struct{}

func (managementPkg) ClientFromPublishSettingsFile(path, subscriptionID string) (managementClient, error) {
	return managementClient{}, nil
}

type vmutilsPkg struct{}

func (vmutilsPkg) NewVMConfiguration(dnsName, size string) role {
	return role{Name: dnsName}
}

func (vmutilsPkg) ConfigureDeploymentFromPlatformImage(r *role, image, mediaLink, label string) error {
	return nil
}

var (
	management managementPkg
	vmutils    vmutilsPkg
	vmSize     = "Small"
	vmImage    = "b39f27a8b8c64d52b05eac6a62ebad85__Ubuntu-14_04_2-LTS-amd64-server-20150309-en-us-30GB"
)

func main() {
	dnsName := "test-vm-from-go"
	storageAccount := "mystorageaccount"
	c := make(chan int)

	client, err := management.ClientFromPublishSettingsFile("path/to/downloaded.publishsettings", "")
	if err != nil {
		panic(err)
	}

	// create virtual machine
	role := vmutils.NewVMConfiguration(dnsName, vmSize)
	vmutils.ConfigureDeploymentFromPlatformImage(
		&role,
		vmImage,
		fmt.Sprintf("http://%s.blob.core.windows.net/sdktest/%s.vhd", storageAccount, dnsName),
		"")

	_ = c
	_ = client
	_ = base64.StdEncoding
}
