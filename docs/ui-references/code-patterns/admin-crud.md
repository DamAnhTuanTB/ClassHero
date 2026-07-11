# Admin CRUD Code Patterns

Dùng file này cho các màn admin CRUD có danh sách, detail, entity con và bulk action. Chỉ ghi các pattern có thể tái sử dụng ở nhiều domain admin; chi tiết chỉ dùng một màn thì để trong code màn đó, không đưa vào đây.

## 1. Admin Master-Detail CRUD

Dùng cho domain có entity cha và entity con, ví dụ nhóm nội dung -> item con -> item cháu.

### Pattern chuẩn

```tsx
export function AdminEntityManager() {
  const { actions, filteredItems, viewState } = useAdminEntityManager();

  return (
    <main data-admin-theme="true" className="theme-page">
      <div className="grid min-h-screen lg:grid-cols-[17rem_minmax(0,1fr)]">
        <AdminSidebar />
        <section className="min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <AdminHeader onCreate={actions.startCreate} />
          <AdminStatsRow />
          <AdminContent viewState={viewState} items={filteredItems} />
        </section>
      </div>

      {actions.isEditorOpen ? <EntityEditorDialog /> : null}
      {actions.deleteTarget ? <DeleteConfirmDialog /> : null}
    </main>
  );
}
```

### Checklist

- Route/page chỉ compose screen; screen dùng hook orchestration như `useAdminEntityManager`.
- Danh sách entity cha chỉ chứa list/filter/create/edit/delete/archive của entity cha.
- Detail route riêng hiển thị summary của entity cha và quản lý entity con.
- Dialog/form nặng dùng dynamic import để route initial load nhẹ hơn.
- Mọi action nhìn bấm được phải có handler/state thật, kể cả khi dữ liệu còn mock/local.
- Màn list/detail có loading, empty, error, retry và disabled/pending state phù hợp.

### Không làm

- Không nhồi form entity con vào trang danh sách entity cha.
- Không render tất cả modal nặng khi chưa mở.
- Không để screen chứa trực tiếp schema/mock/helper dài; tách vào `hooks`, `data`, `schemas`, `utils`.

## 2. Parent-Child Structure Manager

Dùng cho panel quản lý entity con theo cấp bậc, có action tại từng cấp và có thể có reorder.

### Pattern chuẩn

```tsx
<ParentChildStructurePanel
  parent={parent}
  selectedParentItemId={selectedParentItemId}
  selectedChildItemId={selectedChildItemId}
  onCreateParentItem={actions.startCreateParentItem}
  onEditParentItem={actions.startEditParentItem}
  onDeleteParentItem={actions.requestDeleteParentItem}
  onCreateChildItem={actions.startCreateChildItem}
  onEditChildItem={actions.startEditChildItem}
  onDeleteChildItem={actions.requestDeleteChildItem}
  onReorderParentItem={actions.reorderParentItems}
  onReorderChildItem={actions.reorderChildItems}
/>
```

### Checklist

- Entity cha là card riêng; entity con nằm trong vùng con có border/background nhẹ.
- Mỗi item có order chip, status badge, metadata ngắn và action gần item.
- Reorder dùng drag handle riêng có `aria-label`, không biến cả card thành vùng drag.
- Selected/drop target state phải rõ bằng border/ring semantic token.
- Empty state tại đúng cấp: chưa có entity cha thì CTA tạo entity cha; entity cha chưa có entity con thì CTA tạo entity con trong đúng ngữ cảnh.

### Không làm

- Không để action của entity con lẫn với action của entity cha.
- Không dùng status badge cục bộ khác mapping chung.
- Không để row mobile overflow ngang; action có thể wrap thành hàng riêng nhưng button text không wrap.

## 3. Archive Bulk Action Dialog

Dùng cho thùng rác/lưu trữ hoặc modal bulk action.

### Pattern chuẩn

```tsx
<ArchiveBulkActionDialog
  isOpen={isArchiveDialogOpen}
  items={archivedItems}
  onClose={actions.closeArchiveDialog}
  onPermanentDelete={actions.requestPermanentDeleteItems}
  onRestore={actions.restoreItems}
/>
```

### Checklist

- Dùng cùng modal shell 3 vùng như form modal: header fixed, body scroll, footer fixed.
- State chọn item nằm trong dialog và tự dọn khi danh sách item thay đổi.
- Có checkbox chọn tất cả khi danh sách không rỗng.
- Footer bulk action chỉ hiển thị action restore/delete khi có item được chọn; nếu không, chỉ có `Hủy`.
- Từng item vẫn có action riêng để thao tác nhanh một item.
- Xóa vĩnh viễn vẫn đi qua confirm dialog destructive riêng.

### Không làm

- Không cho bulk destructive chạy ngay trong archive dialog mà thiếu confirm khi hành động không thể khôi phục.
- Không hiển thị footer quá dày trên mobile; nếu có 3 action, dùng grid compact và font/padding vừa đủ để label không wrap.
- Không đưa vào pattern code các field hoặc component chỉ phục vụ một domain cụ thể; chỉ ghi shell, state flow và interaction có thể tái dùng.
